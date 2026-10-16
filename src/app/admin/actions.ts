"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas, AsaasError } from "@/lib/asaas";
import { reconcile } from "@/lib/billing";
import { parseMoneyToCents, formatMoney } from "@/lib/format";
import type { ActionState } from "@/lib/types";
import { requirePlatformAdmin } from "./guard";
import { audit } from "./lib";

export async function suspendStudio(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || "Sem motivo informado";
  await createAdminClient()
    .from("studios")
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq("id", studioId);
  await audit(admin.id, "studio.suspend", studioId, { reason });
  revalidatePath("/admin", "layout");
}

export async function reactivateStudio(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  await createAdminClient().from("studios").update({ suspended_at: null, suspended_reason: null }).eq("id", studioId);
  await audit(admin.id, "studio.reactivate", studioId);
  revalidatePath("/admin", "layout");
}

export async function extendTrial(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  const days = z.coerce.number().int().min(1).max(60).parse(formData.get("days"));
  const db = createAdminClient();
  const { data: sub } = await db.from("subscriptions").select("trial_ends_at, status").eq("studio_id", studioId).single();
  const base = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date() ? new Date(sub.trial_ends_at) : new Date();
  const trialEnds = new Date(base.getTime() + days * 86_400_000).toISOString();
  await db
    .from("subscriptions")
    .update({ trial_ends_at: trialEnds, status: sub?.status === "expired" ? "trialing" : sub?.status })
    .eq("studio_id", studioId);
  await audit(admin.id, "subscription.extend_trial", studioId, { days, trial_ends_at: trialEnds });
  revalidatePath("/admin", "layout");
}

/** Preço e dias de teste do plano. Vale para novas assinaturas e para a página de vendas. */
export async function updatePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePlatformAdmin();
  const price = parseMoneyToCents(String(formData.get("price") ?? ""));
  const trial = z.coerce.number().int().min(0).max(90).safeParse(formData.get("trial_days"));
  if (price === null || price < 500 || price > 100_000) return { error: "Informe um preço entre R$ 5,00 e R$ 1.000,00." };
  if (!trial.success) return { error: "Os dias de teste precisam ficar entre 0 e 90." };

  const db = createAdminClient();
  const { data: before } = await db.from("plans").select("price_cents, trial_days").eq("code", "studio").single();
  const { error } = await db.from("plans").update({ price_cents: price, trial_days: trial.data }).eq("code", "studio");
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  await audit(admin.id, "plan.update", null, { before, after: { price_cents: price, trial_days: trial.data } });
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return { message: `Plano salvo: ${formatMoney(price)} por mês, ${trial.data} dias de teste.` };
}

export async function testAsaas(): Promise<ActionState> {
  const admin = await requirePlatformAdmin();
  try {
    const { balance } = await asaas.getBalance();
    await audit(admin.id, "asaas.test", null, { ok: true });
    return { message: `Conectado ao Asaas. Saldo da conta: ${formatMoney(Math.round(balance * 100))}.` };
  } catch (e) {
    await audit(admin.id, "asaas.test", null, { ok: false });
    if (e instanceof AsaasError && e.status === 401) return { error: "O Asaas recusou a chave. Confira a ASAAS_API_KEY na Vercel." };
    if (e instanceof Error && e.message.includes("não configurada"))
      return { error: "A chave do Asaas ainda não foi cadastrada na Vercel (ASAAS_API_KEY)." };
    return { error: `Não foi possível falar com o Asaas: ${e instanceof Error ? e.message : "erro desconhecido"}` };
  }
}

/** Reprocessa avisos pendentes e busca no Asaas as cobranças de cada assinatura. */
export async function reconcileNow(): Promise<ActionState> {
  const admin = await requirePlatformAdmin();
  try {
    const r = await reconcile(createAdminClient());
    await audit(admin.id, "billing.reconcile", null, r);
    revalidatePath("/admin", "layout");
    return {
      message: `Pronto: ${r.subscriptions} assinaturas conferidas, ${r.payments} cobranças atualizadas, ${r.events} avisos reprocessados.`,
      ...(r.errors + r.eventErrors ? { error: `${r.errors + r.eventErrors} itens deram erro e serão tentados de novo.` } : {}),
    };
  } catch (e) {
    return { error: `Falhou: ${e instanceof Error ? e.message : "erro desconhecido"}` };
  }
}
