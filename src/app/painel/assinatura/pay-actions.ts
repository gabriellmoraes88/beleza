"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/studio";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas, AsaasError, type AsaasCard } from "@/lib/asaas";
import { applyPayment } from "@/lib/billing";
import { normalizeCpfCnpj } from "@/lib/cpf-cnpj";
import type { ActionState } from "@/lib/types";

const OPEN = new Set(["PENDING", "OVERDUE"]);
const PAID = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

// Limite de cartões recusados por studio, para o formulário não servir de teste de cartões roubados.
const MAX_DECLINES_PER_HOUR = 5;

/** Cobrança em aberto do studio logado. O id vem do navegador, então sempre confere o dono. */
async function openPayment(paymentId: string) {
  const { studio, user, role, subscription } = await requireStudio();
  if (role !== "owner") return { error: "Somente a proprietária pode pagar a assinatura." } as const;
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, asaas_payment_id, status")
    .eq("id", paymentId)
    .eq("studio_id", studio.id)
    .maybeSingle();
  if (!payment) return { error: "Cobrança não encontrada." } as const;
  return { studio, user, subscription, admin, payment };
}

export type PixResult = { image: string; code: string } | { error: string } | { paid: true };

export async function loadPix(paymentId: string): Promise<PixResult> {
  const ctx = await openPayment(paymentId);
  if ("error" in ctx) return { error: ctx.error! };
  if (PAID.has(ctx.payment.status)) return { paid: true };
  if (!OPEN.has(ctx.payment.status)) return { error: "Esta cobrança não está mais em aberto." };
  try {
    const pix = await asaas.getPixQrCode(ctx.payment.asaas_payment_id);
    return { image: pix.encodedImage, code: pix.payload };
  } catch (e) {
    console.error("asaas: falha ao gerar Pix", e instanceof AsaasError ? e.message : e);
    return { error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." };
  }
}

/** Consulta o Asaas direto (sem esperar o webhook) e atualiza o acesso se já foi pago. */
export async function checkPayment(paymentId: string): Promise<{ paid: boolean }> {
  const ctx = await openPayment(paymentId);
  if ("error" in ctx) return { paid: false };
  if (PAID.has(ctx.payment.status)) return { paid: true };
  try {
    const remote = await asaas.getPayment(ctx.payment.asaas_payment_id);
    if (remote.status !== ctx.payment.status) await applyPayment(ctx.admin, remote);
    if (PAID.has(remote.status)) {
      revalidatePath("/painel", "layout");
      return { paid: true };
    }
  } catch (e) {
    console.error("asaas: falha ao consultar cobrança", e instanceof AsaasError ? e.message : e);
  }
  return { paid: false };
}

function digits(v: FormDataEntryValue | null) {
  return String(v ?? "").replace(/\D/g, "");
}

function readCard(formData: FormData, email: string): AsaasCard | string {
  const holderName = String(formData.get("holder_name") ?? "").trim();
  const number = digits(formData.get("number"));
  const [mm = "", yy = ""] = String(formData.get("expiry") ?? "").split("/").map((s) => s.trim());
  const ccv = digits(formData.get("ccv"));
  const cpfCnpj = normalizeCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  const postalCode = digits(formData.get("postal_code"));
  const addressNumber = String(formData.get("address_number") ?? "").trim();
  const phone = digits(formData.get("phone"));

  const month = Number(mm);
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  if (holderName.length < 3) return "Informe o nome impresso no cartão.";
  if (number.length < 13 || number.length > 19) return "Confira o número do cartão.";
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return "Informe a validade no formato MM/AA.";
  if (ccv.length < 3 || ccv.length > 4) return "Confira o código de segurança (CVV).";
  if (!cpfCnpj) return "Informe um CPF ou CNPJ válido do titular do cartão.";
  if (postalCode.length !== 8) return "Informe um CEP válido.";
  if (!addressNumber) return "Informe o número do endereço.";
  if (phone.length < 10 || phone.length > 11) return "Informe um celular com DDD.";

  return {
    creditCard: { holderName, number, expiryMonth: String(month).padStart(2, "0"), expiryYear: String(year), ccv },
    creditCardHolderInfo: {
      name: holderName,
      email,
      cpfCnpj,
      postalCode,
      addressNumber: addressNumber.slice(0, 20),
      phone,
      mobilePhone: phone,
    },
  };
}

/**
 * Paga a cobrança em aberto com cartão e deixa o cartão cadastrado para as
 * próximas mensalidades. Os dados do cartão vão direto para o Asaas: não são
 * salvos no banco nem escritos em log.
 */
export async function payWithCard(paymentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await openPayment(paymentId);
  if ("error" in ctx) return { error: ctx.error };
  const { admin, payment, studio, user, subscription } = ctx;
  if (PAID.has(payment.status)) return { ok: true, message: "Esta cobrança já está paga." };
  if (!OPEN.has(payment.status)) return { error: "Esta cobrança não está mais em aberto." };

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studio.id)
    .eq("action", "billing.card_declined")
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_DECLINES_PER_HOUR) {
    return { error: "Muitas tentativas recusadas. Aguarde uma hora ou pague com Pix." };
  }

  const card = readCard(formData, user.email ?? "");
  if (typeof card === "string") return { error: card };

  const h = await headers();
  const remoteIp = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";

  let approved = false;
  try {
    const result = await asaas.payWithCreditCard(payment.asaas_payment_id, card);
    await applyPayment(admin, result);
    approved = PAID.has(result.status);
  } catch (e) {
    const reason = e instanceof AsaasError ? e.message : "erro inesperado";
    console.error("asaas: cartão não aprovado", reason);
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "billing.card_declined",
      studio_id: studio.id,
      details: { motivo: reason.slice(0, 200) },
    });
    return {
      error:
        e instanceof AsaasError && e.status < 500
          ? `Pagamento não aprovado: ${reason}`
          : "Não foi possível processar o cartão agora. Tente de novo em instantes.",
    };
  }

  // Próximas mensalidades no mesmo cartão. Se falhar, o pagamento de hoje já valeu
  // e as próximas cobranças continuam podendo ser pagas aqui.
  const subId = subscription?.asaas_subscription_id;
  if (subId && remoteIp) {
    try {
      await asaas.updateSubscriptionCard(subId, { ...card, remoteIp });
      await asaas.updateSubscription(subId, { billingType: "CREDIT_CARD" });
    } catch (e) {
      console.error("asaas: falha ao cadastrar cartão na assinatura", e instanceof AsaasError ? e.message : e);
    }
  }

  revalidatePath("/painel", "layout");
  return approved
    ? { ok: true, message: "Pagamento aprovado! Obrigado." }
    : { ok: true, message: "Pagamento enviado e em análise pelo Asaas. O acesso é liberado assim que for aprovado." };
}
