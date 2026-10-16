import { requirePlatformAdmin } from "../guard";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { PaymentBadge } from "../badges";
import {
  BILLING_LABEL,
  PAYMENT_LABEL,
  type PaymentGroup,
  currentMonth,
  fmtDate,
  fmtDay,
  isMonth,
  monthLabel,
  paymentGroup,
  shiftMonth,
} from "../lib";
import { loadPayments } from "./data";

const GROUPS: PaymentGroup[] = ["pago", "pendente", "atrasado", "estornado"];

export default async function AdminPayments({ searchParams }: PageProps<"/admin/pagamentos">) {
  await requirePlatformAdmin(); // também protegido pelo layout; checado aqui de novo por segurança
  const { mes, situacao } = await searchParams;
  const month = isMonth(mes) ? mes : currentMonth();
  const group = GROUPS.find((g) => g === situacao);
  const all = await loadPayments(month);
  const rows = group ? all.filter((p) => paymentGroup(p.status) === group) : all.filter((p) => p.status !== "DELETED");

  const totals = Object.fromEntries(
    GROUPS.map((g) => {
      const list = all.filter((p) => paymentGroup(p.status) === g);
      return [g, { count: list.length, sum: list.reduce((a, p) => a + p.value_cents, 0) }];
    }),
  ) as Record<PaymentGroup, { count: number; sum: number }>;

  const href = (m: string, g?: string) => {
    const p = new URLSearchParams({ mes: m });
    if (g) p.set("situacao", g);
    return `/admin/pagamentos?${p}`;
  };
  const tone: Record<string, string> = {
    pago: "text-emerald-700",
    pendente: "text-sky-700",
    atrasado: "text-amber-700",
    estornado: "text-rose-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Pagamentos</h1>
          <p className="mt-1 text-sm text-stone-600">Cobranças com vencimento no mês escolhido.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-stone-200 bg-white">
            <Link href={href(shiftMonth(month, -1), group)} className="px-3 py-2 text-stone-500 hover:text-stone-900" aria-label="Mês anterior">
              ‹
            </Link>
            <span className="min-w-36 text-center text-sm font-medium text-stone-900">{monthLabel(month)}</span>
            <Link href={href(shiftMonth(month, 1), group)} className="px-3 py-2 text-stone-500 hover:text-stone-900" aria-label="Próximo mês">
              ›
            </Link>
          </div>
          <a href={`/admin/pagamentos/planilha?${new URLSearchParams({ mes: month, ...(group ? { situacao: group } : {}) })}`} className="btn-primary">
            Baixar planilha
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {GROUPS.map((g) => (
          <Link
            key={g}
            href={href(month, g === group ? undefined : g)}
            className={`rounded-2xl border bg-white p-4 transition hover:shadow-sm ${g === group ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200"}`}
          >
            <p className={`text-xs font-medium ${tone[g]}`}>{PAYMENT_LABEL[g]}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{formatMoney(totals[g].sum)}</p>
            <p className="text-xs text-stone-500">
              {totals[g].count} {totals[g].count === 1 ? "cobrança" : "cobranças"}
            </p>
          </Link>
        ))}
      </div>

      {group && (
        <p className="text-sm text-stone-600">
          Mostrando só <strong>{PAYMENT_LABEL[group].toLowerCase()}</strong>.{" "}
          <Link href={href(month)} className="underline">
            Ver todas
          </Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Studio</th>
              <th className="px-4 py-2.5 font-medium">Vencimento</th>
              <th className="px-4 py-2.5 font-medium">Valor</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 font-medium">Forma</th>
              <th className="px-4 py-2.5 font-medium">Pago em</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/studios/${p.studio_id}`} className="font-medium text-stone-900 hover:underline">
                    {p.studio?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3">{fmtDay(p.due_date)}</td>
                <td className="px-4 py-3">{formatMoney(p.value_cents)}</td>
                <td className="px-4 py-3">
                  <PaymentBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-stone-600">{BILLING_LABEL[p.billing_type ?? ""] ?? p.billing_type ?? "—"}</td>
                <td className="px-4 py-3 text-stone-600">{fmtDate(p.paid_at)}</td>
                <td className="px-4 py-3 text-right">
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-stone-600 hover:text-stone-900 hover:underline">
                      Fatura ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                  Nenhuma cobrança neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
