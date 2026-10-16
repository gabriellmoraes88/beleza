import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asaas, type AsaasPayment, type AsaasSubscription } from "@/lib/asaas";

// Regras de cobrança. Toda escrita em subscriptions/payments passa por aqui,
// usando o cliente admin (service role), nunca pelo navegador.

const PAID = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);
const REVERSED = new Set(["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"]);

export function graceDays(): number {
  const n = Number(process.env.BILLING_GRACE_DAYS ?? 5);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

function addMonths(dateStr: string, months: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Fim do dia do vencimento seguinte (horário de Brasília ≈ UTC-3).
  return new Date(Date.UTC(y, m - 1 + months, d, 23, 59, 59) + 3 * 3_600_000);
}

function addDaysToDate(dateStr: string, days: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 23, 59, 59) + 3 * 3_600_000);
}

type SubRow = {
  id: string;
  studio_id: string;
  status: string;
  current_period_end: string | null;
};

async function findSubscription(
  admin: SupabaseClient,
  asaasSubscriptionId?: string | null,
  externalReference?: string | null,
): Promise<SubRow | null> {
  if (asaasSubscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id, studio_id, status, current_period_end")
      .eq("asaas_subscription_id", asaasSubscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  if (externalReference && /^[0-9a-f-]{36}$/.test(externalReference)) {
    const { data } = await admin
      .from("subscriptions")
      .select("id, studio_id, status, current_period_end")
      .eq("studio_id", externalReference)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Registra a cobrança e atualiza o status da assinatura. Idempotente. */
export async function applyPayment(admin: SupabaseClient, payment: AsaasPayment, opts: { deleted?: boolean } = {}) {
  const sub = await findSubscription(admin, payment.subscription, payment.externalReference);
  if (!sub) return { skipped: "assinatura não encontrada" };

  const paidAt = payment.confirmedDate ?? payment.paymentDate ?? payment.clientPaymentDate ?? null;
  const status = opts.deleted || payment.deleted ? "DELETED" : payment.status;

  const { error: upsertError } = await admin.from("payments").upsert(
    {
      studio_id: sub.studio_id,
      subscription_id: sub.id,
      asaas_payment_id: payment.id,
      status,
      billing_type: payment.billingType ?? null,
      value_cents: Math.round(Number(payment.value) * 100),
      due_date: payment.dueDate ?? null,
      paid_at: PAID.has(status) && paidAt ? new Date(paidAt).toISOString() : null,
      invoice_url: payment.invoiceUrl ?? null,
    },
    { onConflict: "asaas_payment_id" },
  );
  if (upsertError) throw upsertError;

  const now = new Date();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  let patch: Record<string, unknown> | null = null;

  if (PAID.has(status) && payment.dueDate) {
    const newEnd = addMonths(payment.dueDate, 1);
    patch = {
      status: sub.status === "canceled" ? "canceled" : "active",
      current_period_end: (periodEnd && periodEnd > newEnd ? periodEnd : newEnd).toISOString(),
      grace_until: null,
    };
  } else if (status === "OVERDUE" && payment.dueDate) {
    // Só marca atraso se o período pago já terminou (evita eventos fora de ordem).
    if (sub.status !== "canceled" && (!periodEnd || periodEnd < now)) {
      patch = { status: "past_due", grace_until: addDaysToDate(payment.dueDate, graceDays()).toISOString() };
    }
  } else if (REVERSED.has(status)) {
    // Estorno/chargeback: o período deixa de estar pago, sem tolerância extra.
    patch = { status: sub.status === "canceled" ? "canceled" : "past_due", current_period_end: now.toISOString(), grace_until: now.toISOString() };
  }
  // PENDING, AWAITING_RISK_ANALYSIS etc.: cobrança criada NÃO é pagamento; nada muda.

  if (patch) {
    const { error } = await admin.from("subscriptions").update(patch).eq("id", sub.id);
    if (error) throw error;
  }
  return { studioId: sub.studio_id, status };
}

export async function applySubscriptionEvent(admin: SupabaseClient, event: string, subscription: AsaasSubscription) {
  const sub = await findSubscription(admin, subscription.id, subscription.externalReference);
  if (!sub) return { skipped: "assinatura não encontrada" };
  if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED" || subscription.deleted) {
    // Mantém o acesso até o fim do período já pago (current_period_end).
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) throw error;
  }
  return { studioId: sub.studio_id };
}

type WebhookPayload = {
  id: string;
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

/** Processa um evento já persistido na caixa de entrada. */
export async function processWebhookEvent(admin: SupabaseClient, payload: WebhookPayload) {
  if (payload.payment) {
    return applyPayment(admin, payload.payment, { deleted: payload.event === "PAYMENT_DELETED" });
  }
  if (payload.subscription) {
    return applySubscriptionEvent(admin, payload.event, payload.subscription);
  }
  return { skipped: "evento sem recurso tratado" };
}

/** Marca o resultado do processamento de um evento. */
export async function markEvent(admin: SupabaseClient, id: string, attempts: number, error?: unknown) {
  await admin
    .from("asaas_webhook_events")
    .update({
      processed_at: error ? null : new Date().toISOString(),
      attempts: attempts + 1,
      last_error: error ? String((error as Error)?.message ?? error).slice(0, 500) : null,
    })
    .eq("id", id);
}

/**
 * Conciliação: reprocessa eventos pendentes e consulta no Asaas as cobranças
 * de cada assinatura, cobrindo notificações perdidas.
 */
export async function reconcile(admin: SupabaseClient) {
  const result = { events: 0, eventErrors: 0, subscriptions: 0, payments: 0, errors: 0, trialsExpired: 0 };

  const { data: pending } = await admin
    .from("asaas_webhook_events")
    .select("id, payload, attempts")
    .is("processed_at", null)
    .lt("attempts", 20)
    .order("received_at")
    .limit(200);
  for (const ev of pending ?? []) {
    try {
      await processWebhookEvent(admin, ev.payload as WebhookPayload);
      await markEvent(admin, ev.id, ev.attempts);
      result.events++;
    } catch (e) {
      await markEvent(admin, ev.id, ev.attempts, e);
      result.eventErrors++;
    }
  }

  const { data: subs } = await admin
    .from("subscriptions")
    .select("id, asaas_subscription_id, status")
    .not("asaas_subscription_id", "is", null)
    .neq("status", "expired")
    .limit(1000);
  for (const sub of subs ?? []) {
    try {
      const { data: payments } = await asaas.listSubscriptionPayments(sub.asaas_subscription_id!);
      // Mais antigas primeiro, para o status final refletir a cobrança mais recente.
      for (const p of [...payments].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))) {
        await applyPayment(admin, p);
        result.payments++;
      }
      if (sub.status !== "canceled") {
        const remote = await asaas.getSubscription(sub.asaas_subscription_id!);
        if (remote.deleted || remote.status === "INACTIVE" || remote.status === "EXPIRED") {
          await applySubscriptionEvent(admin, "SUBSCRIPTION_INACTIVATED", remote);
        }
      }
      result.subscriptions++;
    } catch {
      result.errors++;
    }
  }

  // Testes vencidos sem assinatura passam a "expired" (o acesso já é bloqueado pela data).
  const { data: expired } = await admin
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "trialing")
    .is("asaas_subscription_id", null)
    .lt("trial_ends_at", new Date().toISOString())
    .select("id");
  result.trialsExpired = expired?.length ?? 0;

  return result;
}
