import { PAYMENT_LABEL, PAYMENT_STYLE, SUB_LABEL, SUB_STYLE, paymentGroup } from "./lib";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function SubBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-stone-400">—</span>;
  return <span className={`${base} ${SUB_STYLE[status] ?? ""}`}>{SUB_LABEL[status] ?? status}</span>;
}

export function PaymentBadge({ status }: { status: string }) {
  const g = paymentGroup(status);
  return <span className={`${base} ${PAYMENT_STYLE[g]}`}>{PAYMENT_LABEL[g]}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
