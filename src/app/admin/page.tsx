import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { daysFromNow } from "@/lib/time";
import { requirePlatformAdmin } from "./guard";
import { extendTrial, reactivateStudio, suspendStudio } from "./actions";
import { ConfirmButton, SubmitButton } from "@/components/form";

export const metadata: Metadata = { title: "Administração", robots: { index: false } };

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(iso)) : "—";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();

  // Apenas dados do negócio (studio/assinatura). Dados de clientes finais não são listados aqui.
  let query = db
    .from("studios")
    .select(
      "id, name, slug, created_at, suspended_at, suspended_reason, subscriptions(status, trial_ends_at, current_period_end, grace_until)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (typeof q === "string" && q.trim()) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,slug.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data: studios }, { data: recentPayments }, { data: auditRows }] = await Promise.all([
    query,
    db.from("payments").select("value_cents, status, paid_at").gte("paid_at", daysFromNow(-30).toISOString()),
    db.from("audit_log").select("id, action, studio_id, details, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const counts: Record<string, number> = {};
  for (const s of studios ?? []) {
    const status = (s.subscriptions as unknown as { status: string }[] | { status: string } | null);
    const st = Array.isArray(status) ? status[0]?.status : status?.status;
    counts[st ?? "—"] = (counts[st ?? "—"] ?? 0) + 1;
  }
  const revenue30d = (recentPayments ?? []).reduce((acc, p) => acc + p.value_cents, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administração da plataforma</h1>
        <Link href="/painel" className="btn-ghost">
          Ir para o painel
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Studios", studios?.length ?? 0],
          ["Em teste", counts.trialing ?? 0],
          ["Ativos", counts.active ?? 0],
          ["Em atraso", counts.past_due ?? 0],
          ["Recebido 30 dias", formatMoney(revenue30d)],
        ].map(([label, value]) => (
          <div key={label} className="card py-3">
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-stone-500">{label}</p>
          </div>
        ))}
      </div>

      <form className="mb-4 flex max-w-md gap-2">
        <input className="input" name="q" placeholder="Buscar studio" defaultValue={typeof q === "string" ? q : ""} />
        <button className="btn-secondary">Buscar</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-2">Studio</th>
              <th className="px-4 py-2">Assinatura</th>
              <th className="px-4 py-2">Teste / pago até</th>
              <th className="px-4 py-2">Criado</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(studios ?? []).map((s) => {
              const raw = s.subscriptions as unknown;
              const sub = (Array.isArray(raw) ? raw[0] : raw) as
                | { status: string; trial_ends_at: string | null; current_period_end: string | null }
                | null;
              return (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.name}</p>
                    <Link href={`/s/${s.slug}`} className="text-xs text-brand-700 hover:underline" target="_blank">
                      /s/{s.slug}
                    </Link>
                    {s.suspended_at && <p className="text-xs text-rose-700">Suspenso: {s.suspended_reason}</p>}
                  </td>
                  <td className="px-4 py-3">{sub?.status ?? "—"}</td>
                  <td className="px-4 py-3">
                    {sub?.status === "trialing" || sub?.status === "expired"
                      ? fmtDate(sub.trial_ends_at)
                      : fmtDate(sub?.current_period_end ?? null)}
                  </td>
                  <td className="px-4 py-3">{fmtDate(s.created_at)}</td>
                  <td className="space-y-2 px-4 py-3">
                    <form action={extendTrial} className="flex gap-1">
                      <input type="hidden" name="studio_id" value={s.id} />
                      <input className="input w-16 py-1" type="number" name="days" defaultValue={7} min={1} max={60} />
                      <SubmitButton className="btn-secondary px-2 py-1" pendingText="…">
                        + dias de teste
                      </SubmitButton>
                    </form>
                    {s.suspended_at ? (
                      <form action={reactivateStudio}>
                        <input type="hidden" name="studio_id" value={s.id} />
                        <SubmitButton className="btn-secondary px-2 py-1">Reativar</SubmitButton>
                      </form>
                    ) : (
                      <form action={suspendStudio} className="flex gap-1">
                        <input type="hidden" name="studio_id" value={s.id} />
                        <input className="input py-1" name="reason" placeholder="Motivo" />
                        <ConfirmButton message="Suspender este studio? Os dados serão preservados." className="btn-danger px-2 py-1">
                          Suspender
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Registro de operações</h2>
      <ul className="space-y-1 text-sm text-stone-600">
        {(auditRows ?? []).map((a) => (
          <li key={a.id}>
            {fmtDate(a.created_at)} · {a.action} · {JSON.stringify(a.details)}
          </li>
        ))}
      </ul>
    </main>
  );
}
