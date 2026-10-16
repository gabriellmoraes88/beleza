"use server";

import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/studio";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas, AsaasError } from "@/lib/asaas";
import { applyPayment } from "@/lib/billing";
import { normalizeCpfCnpj } from "@/lib/cpf-cnpj";
import { toLocalDate, todayIn } from "@/lib/time";
import type { ActionState } from "@/lib/types";

/**
 * Cria cliente + assinatura no Asaas para o studio do usuário logado.
 * Criar a assinatura NÃO libera acesso: isso só acontece quando o webhook
 * confirmar o pagamento.
 */
export async function startSubscription(_: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user, role, subscription } = await requireStudio();
  if (role !== "owner") return { error: "Somente a proprietária pode gerenciar a assinatura." };
  if (!subscription) return { error: "Assinatura não encontrada." };
  if (subscription.asaas_subscription_id && subscription.status !== "canceled" && subscription.status !== "expired") {
    return { error: "Sua assinatura já está criada." };
  }

  const cpfCnpj = normalizeCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  if (!cpfCnpj) return { error: "Informe um CPF ou CNPJ válido." };
  const name = String(formData.get("name") ?? "").trim() || studio.owner_name || studio.name;

  const admin = createAdminClient();
  const { data: plan } = await admin.from("plans").select("name, price_cents").eq("code", subscription.plan_code).single();
  if (!plan) return { error: "Plano não encontrado." };

  try {
    let customerId = subscription.asaas_customer_id;
    if (!customerId) {
      const customer = await asaas.createCustomer({
        name,
        cpfCnpj,
        email: user.email ?? undefined,
        mobilePhone: studio.whatsapp?.replace(/^55/, "") ?? undefined,
        externalReference: studio.id,
      });
      customerId = customer.id;
      await admin.from("subscriptions").update({ asaas_customer_id: customerId }).eq("id", subscription.id);
    }

    // Se o teste ainda está ativo, a primeira cobrança vence no fim do teste.
    const today = todayIn(studio.timezone);
    const trialEndDate = subscription.trial_ends_at
      ? toLocalDate(new Date(subscription.trial_ends_at), studio.timezone)
      : today;
    const nextDueDate = subscription.status === "trialing" && trialEndDate > today ? trialEndDate : today;

    const created = await asaas.createSubscription({
      customer: customerId,
      billingType: "UNDEFINED", // a cliente escolhe Pix, boleto ou cartão na fatura
      value: plan.price_cents / 100,
      nextDueDate,
      cycle: "MONTHLY",
      description: `${plan.name} - ${studio.name}`,
      externalReference: studio.id,
    });

    await admin
      .from("subscriptions")
      .update({ asaas_subscription_id: created.id, canceled_at: null })
      .eq("id", subscription.id);

    const { data: payments } = await asaas.listSubscriptionPayments(created.id);
    for (const p of payments) await applyPayment(admin, p);
  } catch (e) {
    console.error("asaas: falha ao criar assinatura", e);
    return {
      error: e instanceof AsaasError ? `Asaas: ${e.message}` : "Não foi possível criar a assinatura agora. Tente novamente.",
    };
  }

  revalidatePath("/painel", "layout");
  return { message: "Assinatura criada! Escolha Pix ou cartão logo acima para pagar." };
}

export async function cancelSubscription(): Promise<void> {
  const { role, subscription } = await requireStudio();
  if (role !== "owner" || !subscription?.asaas_subscription_id) return;
  await asaas.cancelSubscription(subscription.asaas_subscription_id);
  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", subscription.id);
  revalidatePath("/painel", "layout");
}
