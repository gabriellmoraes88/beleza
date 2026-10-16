import { requirePlatformAdmin } from "./guard";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { Stat, SubBadge } from "./badges";
import {
  AUDIT_LABEL,
  PAYMENT_GROUPS,
  currentMonth,
  fmtDate,
  fmtDateTime,
  monthLabel,
  monthRange,
  one,
  shiftMonth,
} from "./lib";

type Sub = { status: string; trial_ends_at: string | null; grace_until: string | null };

export default async function AdminOverview() {
  await requirePlatformAdmin(); // também protegido pelo layout; checado aqui de novo por segurança
  const db = createAdminClient();
  const month = currentMonth();
  const firstMonth = shiftMonth(month, -5);
  const { from: monthFrom, to: monthTo } = monthRange(month);
  const now = new Date();

  const [{ data: studios }, { data: payments }, { data: plan }, { data: auditRows }, { count: webhookErrors }] = await Promise.all([
    db
      .from("studios")
      .select("id, name, slug, created_at, suspended_at, subscriptions(status, trial_ends_at, grace_until)")
      .order("created_at", { ascending: false })
      .limit(5000),
    db
      .from("payments")
      .select("studio_id, status, value_cents, due_date, paid_at")
      .or(`paid_at.gte.${monthRange(firstMonth).from},due_date.gte.${monthRange(firstMonth).from}`)
      .limit(20000),
    db.from("plans").select("price_cents").eq("code", "studio").maybeSingle(),
    db.from("audit_log").select("id, action, studio_id, details, created_at, studios(name)").order("created_at", { ascending: false }).limit(8),
    db.from("asaas_webhook_events").select("id", { count: "exact", head: true }).is("processed_at", null).gt("attempts", 0),
  ]);

  const list = (studios ?? []).map((s) => ({ ...s, sub: one<Sub>(s.subscriptions) }));
  const count = (st: string) => list.filter((s) => s.sub?.status === st).length;
  const active = count("active");
  const newLast30 = list.filter((s) => now.getTime() - new Date(s.created_at).getTime() < 30 * 86_400_000).length;
  const price = plan?.price_cents ?? 0;

  const paid = (payments ?? []).filter((p) => PAYMENT_GROUPS.pago.includes(p.status) && p.paid_at);
  const receivedThisMonth = paid.filter((p) => p.paid_at! >= monthFrom && p.paid_at! < monthTo).reduce((a, p) => a + p.value_cents, 0);
  const dueThisMonth = (payments ?? []).filter((p) => p.due_date && p.due_date >= monthFrom && p.due_date < monthTo);
  const openThisMonth = dueThisMonth
    .filter((p) => [...PAYMENT_GROUPS.pendente, ...PAYMENT_GROUPS.atrasado].includes(p.status))
    .reduce((a, p) => a + p.value_cents, 0);

  // Conversão: dos studios cujo teste já acabou, quantos chegaram a pagar.
  const everPaid = new Set(paid.map((p) => p.studio_id));
  const trialEnded = list.filter((s) => s.sub?.trial_ends_at && new Date(s.sub.trial_ends_at) < now);
  const converted = trialEnded.filter((s) => everPaid.has(s.id) || ["active", "past_due", "canceled"].includes(s.sub?.status ?? "")).length;
  const conversion = trialEnded.length ? Math.round((converted / trialEnded.length) * 100) : null;

  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(firstMonth, i));
  const byMonth = months.map((m) => {
    const { from, to } = monthRange(m);
    return { month: m, total: paid.filter((p) => p.paid_at! >= from && p.paid_at! < to).reduce((a, p) => a + p.value_cents, 0) };
  });
  const maxMonth = Math.max(...byMonth.map((m) => m.total), 1);

  const overdue = list.filter((s) => s.sub?.status === "past_due");
  const endingTrials = list
    .filter((s) => {
      const end = s.sub?.status === "trialing" && s.sub.trial_ends_at ? new Date(s.sub.trial_ends_at).getTime() : null;
      return end !== null && end > now.getTime() && end - now.getTime() < 3 * 86_400_000;
    })
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Visão geral</h1>
        <p className="mt-1 text-sm text-stone-600">{monthLabel(month)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido no mês" value={formatMoney(receivedThisMonth)} hint={`${formatMoney(openThisMonth)} ainda em aberto`} />
        <Stat label="Receita mensal recorrente" value={formatMoney(active * price)} hint={`${active} assinaturas ativas`} />
        <Stat label="Studios cadastrados" value={list.length} hint={`${newLast30} novos nos últimos 30 dias`} />
        <Stat
          label="Teste que virou assinatura"
          value={conversion === null ? "—" : `${conversion}%`}
          hint={trialEnded.length ? `${converted} de ${trialEnded.length} testes encerrados` : "Nenhum teste encerrado ainda"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["trialing", "Em teste"],
            ["active", "Ativas"],
            ["past_due", "Em atraso"],
            ["canceled", "Canceladas"],
            ["expired", "Teste expirado"],
          ] as const
        ).map(([st, label]) => (
          <Link
            key={st}
            href={`/admin/studios?situacao=${st}`}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300 hover:shadow-sm"
          >
            <p className="text-xl font-semibold text-stone-900">{count(st)}</p>
            <p className="text-xs text-stone-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-stone-900">Recebido por mês</h2>
            <Link href="/admin/pagamentos" className="text-sm text-stone-600 hover:text-stone-900 hover:underline">
              Ver pagamentos
            </Link>
          </div>
          <div className="mt-6 flex h-44 items-end gap-3">
            {byMonth.map((m) => (
              <Link key={m.month} href={`/admin/pagamentos?mes=${m.month}`} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-medium text-stone-500 group-hover:text-stone-900">
                  {m.total ? formatMoney(m.total).replace(",00", "") : ""}
                </span>
                <span
                  className={`w-full max-w-12 rounded-t-lg transition ${m.month === month ? "bg-stone-900" : "bg-stone-300 group-hover:bg-stone-400"}`}
                  style={{ height: `${Math.max((m.total / maxMonth) * 120, 3)}px` }}
                />
                <span className="text-xs text-stone-500">{monthLabel(m.month, "short")}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold text-stone-900">Precisa de atenção</h2>
          {overdue.length === 0 && endingTrials.length === 0 && !webhookErrors ? (
            <p className="mt-4 text-sm text-stone-500">Nada pendente agora.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {!!webhookErrors && (
                <li className="py-2.5">
                  <Link href="/admin/configuracoes" className="font-medium text-rose-700 hover:underline">
                    {webhookErrors} aviso(s) do Asaas com erro
                  </Link>
                </li>
              )}
              {overdue.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/studios/${s.id}`} className="truncate font-medium text-stone-800 hover:underline">
                    {s.name}
                  </Link>
                  <span className="shrink-0 text-xs text-amber-700">
                    Em atraso{s.sub?.grace_until ? ` · bloqueia ${fmtDate(s.sub.grace_until)}` : ""}
                  </span>
                </li>
              ))}
              {endingTrials.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/studios/${s.id}`} className="truncate font-medium text-stone-800 hover:underline">
                    {s.name}
                  </Link>
                  <span className="shrink-0 text-xs text-sky-700">Teste acaba {fmtDate(s.sub?.trial_ends_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-stone-900">Últimos cadastros</h2>
            <Link href="/admin/studios" className="text-sm text-stone-600 hover:text-stone-900 hover:underline">
              Ver todos
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {list.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/studios/${s.id}`} className="min-w-0">
                  <p className="truncate font-medium text-stone-800 hover:underline">{s.name}</p>
                  <p className="text-xs text-stone-500">{fmtDate(s.created_at)}</p>
                </Link>
                <SubBadge status={s.sub?.status} />
              </li>
            ))}
            {list.length === 0 && <li className="py-3 text-stone-500">Nenhum studio ainda.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Registro de operações</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {(auditRows ?? []).map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="font-medium text-stone-800">
                  {AUDIT_LABEL[a.action] ?? a.action}
                  {one<{ name: string }>(a.studios) ? ` · ${one<{ name: string }>(a.studios)!.name}` : ""}
                </p>
                <p className="text-xs text-stone-500">{fmtDateTime(a.created_at)}</p>
              </li>
            ))}
            {(auditRows ?? []).length === 0 && <li className="py-3 text-stone-500">Nenhuma operação registrada.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
