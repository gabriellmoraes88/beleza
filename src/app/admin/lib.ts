import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const SUB_LABEL: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Em atraso",
  canceled: "Cancelada",
  expired: "Teste expirado",
};

export const SUB_STYLE: Record<string, string> = {
  trialing: "bg-sky-50 text-sky-800 ring-sky-200",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  past_due: "bg-amber-50 text-amber-800 ring-amber-200",
  canceled: "bg-stone-100 text-stone-600 ring-stone-200",
  expired: "bg-rose-50 text-rose-800 ring-rose-200",
};

const PAID = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
const REVERSED = ["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"];

/** Agrupa os status do Asaas nos quatro que importam para o relatório. */
export type PaymentGroup = "pago" | "pendente" | "atrasado" | "estornado" | "removido";

export const PAYMENT_GROUPS: Record<PaymentGroup, string[]> = {
  pago: PAID,
  pendente: ["PENDING", "AWAITING_RISK_ANALYSIS"],
  atrasado: ["OVERDUE", "DUNNING_REQUESTED"],
  estornado: REVERSED,
  removido: ["DELETED"],
};

export const PAYMENT_LABEL: Record<PaymentGroup, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
  estornado: "Estornado",
  removido: "Removida",
};

export const PAYMENT_STYLE: Record<PaymentGroup, string> = {
  pago: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pendente: "bg-sky-50 text-sky-800 ring-sky-200",
  atrasado: "bg-amber-50 text-amber-800 ring-amber-200",
  estornado: "bg-rose-50 text-rose-800 ring-rose-200",
  removido: "bg-stone-100 text-stone-500 ring-stone-200",
};

export function paymentGroup(status: string): PaymentGroup {
  for (const [group, list] of Object.entries(PAYMENT_GROUPS)) if (list.includes(status)) return group as PaymentGroup;
  return status === "DUNNING_RECEIVED" ? "pago" : "pendente";
}

export const BILLING_LABEL: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "A escolher",
};

const tz = "America/Sao_Paulo";

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: tz, dateStyle: "short" }).format(new Date(iso)) : "—";

/** Datas "YYYY-MM-DD" (sem hora) não passam por fuso. */
export const fmtDay = (day: string | null | undefined) => (day ? day.split("-").reverse().join("/") : "—");

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
    : "—";

/** Mês atual em Brasília, "YYYY-MM". */
export function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date());
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: style, year: style === "long" ? "numeric" : undefined }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(" de ", " ").replace(".", "");
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Toda operação sensível do administrador é registrada em audit_log. */
export async function audit(actorId: string, action: string, studioId: string | null, details: Record<string, unknown> = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, studio_id: studioId, details });
}

export const AUDIT_LABEL: Record<string, string> = {
  "studio.suspend": "Studio suspenso",
  "studio.reactivate": "Studio reativado",
  "subscription.extend_trial": "Teste estendido",
  "plan.update": "Plano alterado",
  "billing.reconcile": "Conciliação manual",
  "asaas.test": "Teste de conexão Asaas",
  "report.export": "Relatório baixado",
  "billing.card_declined": "Cartão recusado",
};

/** Uma linha de assinatura vem como objeto (studio_id é único), mas o tipo do supabase-js diz array. */
export function one<T>(raw: unknown): T | null {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? null) as T | null;
}
