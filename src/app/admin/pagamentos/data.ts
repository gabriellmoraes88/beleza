import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_GROUPS, type PaymentGroup, monthRange, one } from "../lib";

export type PaymentRow = {
  id: string;
  studio_id: string;
  studio: { name: string; slug: string } | null;
  status: string;
  billing_type: string | null;
  value_cents: number;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
};

/** Cobranças com vencimento no mês, opcionalmente filtradas por situação. */
export async function loadPayments(month: string, group?: PaymentGroup): Promise<PaymentRow[]> {
  const { from, to } = monthRange(month);
  let query = createAdminClient()
    .from("payments")
    .select("id, studio_id, status, billing_type, value_cents, due_date, paid_at, invoice_url, studios(name, slug)")
    .gte("due_date", from)
    .lt("due_date", to)
    .order("due_date", { ascending: true })
    .limit(5000);
  if (group) query = query.in("status", PAYMENT_GROUPS[group]);
  const { data } = await query;
  return (data ?? []).map(({ studios, ...p }) => ({ ...p, studio: one<{ name: string; slug: string }>(studios) }));
}
