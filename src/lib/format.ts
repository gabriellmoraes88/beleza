export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "R$ 35,00" | "35,5" | "35" -> centavos */
export function parseMoneyToCents(input: string): number | null {
  const clean = (input ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Nome digitado naquele agendamento; se não houver, o nome da ficha. */
export function bookedName(appt: { customer_name?: string | null; customers?: { name: string } | null }): string {
  return appt.customer_name ?? appt.customers?.name ?? "Cliente";
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "Faltou",
};

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-sky-50 text-sky-800 ring-sky-200",
  canceled: "bg-stone-100 text-stone-500 ring-stone-200 line-through",
  no_show: "bg-rose-50 text-rose-800 ring-rose-200",
};
