import { requirePlatformAdmin } from "../../guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { daysFromNow } from "@/lib/time";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { PaymentBadge, Stat, SubBadge } from "../../badges";
import { AUDIT_LABEL, BILLING_LABEL, PAYMENT_GROUPS, fmtDate, fmtDateTime, fmtDay, one } from "../../lib";
import { extendTrial, reactivateStudio, suspendStudio } from "../../actions";

type Sub = {
  status: string;
  plan_code: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  canceled_at: string | null;
  asaas_subscription_id: string | null;
};

export default async function AdminStudio({ params }: PageProps<"/admin/studios/[id]">) {
  await requirePlatformAdmin(); // também protegido pelo layout; checado aqui de novo por segurança
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = createAdminClient();

  const { data: studio } = await db
    .from("studios")
    .select(
      "id, name, slug, owner_name, phone, whatsapp, city, instagram, created_at, created_by, suspended_at, suspended_reason, subscriptions(status, plan_code, trial_ends_at, current_period_end, grace_until, canceled_at, asaas_subscription_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!studio) notFound();

  // Só contagens de uso: dados das clientes finais não aparecem aqui.
  const [{ data: payments }, { data: auditRows }, { count: services }, { count: appts30 }, owner] = await Promise.all([
    db
      .from("payments")
      .select("id, status, billing_type, value_cents, due_date, paid_at, invoice_url")
      .eq("studio_id", id)
      .order("due_date", { ascending: false })
      .limit(60),
    db.from("audit_log").select("id, action, details, created_at").eq("studio_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("services").select("id", { count: "exact", head: true }).eq("studio_id", id).eq("active", true),
    db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", id)
      .gte("created_at", daysFromNow(-30).toISOString()),
    studio.created_by ? db.auth.admin.getUserById(studio.created_by) : Promise.resolve(null),
  ]);

  const sub = one<Sub>(studio.subscriptions);
  const totalPaid = (payments ?? []).filter((p) => PAYMENT_GROUPS.pago.includes(p.status)).reduce((a, p) => a + p.value_cents, 0);
  const email = owner?.data?.user?.email;
  const phone = studio.whatsapp ?? studio.phone;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/studios" className="text-sm text-stone-500 hover:text-stone-900">
          ← Studios
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{studio.name}</h1>
          <SubBadge status={sub?.status} />
          {studio.suspended_at && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200">
              Suspenso
            </span>
          )}
        </div>
        <Link href={`/s/${studio.slug}`} target="_blank" className="text-sm text-stone-600 hover:underline">
          Ver página de agendamento (/s/{studio.slug}) ↗
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total já pago" value={formatMoney(totalPaid)} />
        <Stat
          label={sub?.status === "trialing" || sub?.status === "expired" ? "Teste até" : "Pago até"}
          value={sub?.status === "trialing" || sub?.status === "expired" ? fmtDate(sub?.trial_ends_at) : fmtDate(sub?.current_period_end)}
          hint={sub?.grace_until ? `Tolerância até ${fmtDate(sub.grace_until)}` : undefined}
        />
        <Stat label="Serviços ativos" value={services ?? 0} />
        <Stat label="Agendamentos em 30 dias" value={appts30 ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold text-stone-900">Dados do studio</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            {(
              [
                ["Responsável", studio.owner_name],
                ["E-mail da conta", email],
                ["WhatsApp", phone],
                ["Cidade", studio.city],
                ["Instagram", studio.instagram],
                ["Cadastro", fmtDate(studio.created_at)],
                ["Assinatura no Asaas", sub?.asaas_subscription_id ?? "Ainda não assinou"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="break-all text-stone-800">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {phone && (
            <a
              href={`https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary mt-4 w-full"
            >
              Chamar no WhatsApp
            </a>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold text-stone-900">Pagamentos</h2>
          <div className="-mx-5 mt-3 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Vencimento</th>
                  <th className="px-5 py-2 font-medium">Valor</th>
                  <th className="px-5 py-2 font-medium">Situação</th>
                  <th className="px-5 py-2 font-medium">Forma</th>
                  <th className="px-5 py-2 font-medium">Pago em</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5">{fmtDay(p.due_date)}</td>
                    <td className="px-5 py-2.5">{formatMoney(p.value_cents)}</td>
                    <td className="px-5 py-2.5">
                      <PaymentBadge status={p.status} />
                    </td>
                    <td className="px-5 py-2.5 text-stone-600">{BILLING_LABEL[p.billing_type ?? ""] ?? p.billing_type ?? "—"}</td>
                    <td className="px-5 py-2.5 text-stone-600">{fmtDate(p.paid_at)}</td>
                    <td className="px-5 py-2.5 text-right">
                      {p.invoice_url && (
                        <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-stone-600 hover:text-stone-900 hover:underline">
                          Fatura ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {(payments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-stone-500">
                      Nenhuma cobrança ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Ações</h2>
          <form action={extendTrial} className="mt-4">
            <input type="hidden" name="studio_id" value={studio.id} />
            <p className="label">Dar mais dias de teste</p>
            <div className="flex gap-2">
              <input className="input w-24" type="number" name="days" defaultValue={7} min={1} max={60} />
              <SubmitButton className="btn-secondary" pendingText="Salvando…">
                Adicionar dias
              </SubmitButton>
            </div>
          </form>
          <div className="mt-5 border-t border-stone-100 pt-5">
            {studio.suspended_at ? (
              <form action={reactivateStudio}>
                <input type="hidden" name="studio_id" value={studio.id} />
                <p className="mb-2 text-sm text-stone-600">
                  Suspenso em {fmtDate(studio.suspended_at)}: {studio.suspended_reason}
                </p>
                <SubmitButton className="btn-secondary">Reativar studio</SubmitButton>
              </form>
            ) : (
              <form action={suspendStudio}>
                <input type="hidden" name="studio_id" value={studio.id} />
                <p className="label">Suspender studio</p>
                <div className="flex gap-2">
                  <input className="input" name="reason" placeholder="Motivo" />
                  <ConfirmButton message="Suspender este studio? A página de agendamento sai do ar, mas os dados ficam guardados." className="btn-danger">
                    Suspender
                  </ConfirmButton>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Histórico de operações</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {(auditRows ?? []).map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="font-medium text-stone-800">{AUDIT_LABEL[a.action] ?? a.action}</p>
                <p className="text-xs text-stone-500">
                  {fmtDateTime(a.created_at)}
                  {a.details && typeof a.details === "object" && "reason" in a.details ? ` · ${String(a.details.reason)}` : ""}
                  {a.details && typeof a.details === "object" && "days" in a.details ? ` · +${String(a.details.days)} dias` : ""}
                </p>
              </li>
            ))}
            {(auditRows ?? []).length === 0 && <li className="py-3 text-stone-500">Nenhuma operação registrada.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
