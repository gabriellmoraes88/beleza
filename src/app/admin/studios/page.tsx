import { requirePlatformAdmin } from "../guard";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubBadge } from "../badges";
import { SUB_LABEL, fmtDate, one } from "../lib";

type Sub = { status: string; trial_ends_at: string | null; current_period_end: string | null };

const FILTERS = ["trialing", "active", "past_due", "canceled", "expired"] as const;

export default async function AdminStudios({ searchParams }: PageProps<"/admin/studios">) {
  await requirePlatformAdmin(); // também protegido pelo layout; checado aqui de novo por segurança
  const { q, situacao } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const status = FILTERS.find((f) => f === situacao);
  const db = createAdminClient();

  let query = db
    .from("studios")
    .select(
      `id, name, slug, city, created_at, suspended_at, subscriptions${status ? "!inner" : ""}(status, trial_ends_at, current_period_end)`,
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("subscriptions.status", status);
  if (search) {
    const s = search.replace(/[%,()]/g, "");
    query = query.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  const { data: studios } = await query;

  const href = (st?: string) => {
    const p = new URLSearchParams();
    if (st) p.set("situacao", st);
    if (search) p.set("q", search);
    const qs = p.toString();
    return `/admin/studios${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Studios</h1>
          <p className="mt-1 text-sm text-stone-600">{studios?.length ?? 0} encontrados</p>
        </div>
        <form className="flex w-full max-w-sm gap-2">
          {status && <input type="hidden" name="situacao" value={status} />}
          <input className="input" name="q" placeholder="Buscar por nome ou link" defaultValue={search} />
          <button className="btn-secondary">Buscar</button>
        </form>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {[undefined, ...FILTERS].map((st) => (
          <Link
            key={st ?? "todos"}
            href={href(st)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
              st === status ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300"
            }`}
          >
            {st ? SUB_LABEL[st] : "Todos"}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Studio</th>
              <th className="px-4 py-2.5 font-medium">Assinatura</th>
              <th className="px-4 py-2.5 font-medium">Teste / pago até</th>
              <th className="px-4 py-2.5 font-medium">Cadastro</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(studios ?? []).map((s) => {
              const sub = one<Sub>(s.subscriptions);
              return (
                <tr key={s.id} className="hover:bg-stone-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/studios/${s.id}`} className="font-medium text-stone-900 hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      /s/{s.slug}
                      {s.city ? ` · ${s.city}` : ""}
                    </p>
                    {s.suspended_at && <p className="text-xs font-medium text-rose-700">Suspenso</p>}
                  </td>
                  <td className="px-4 py-3">
                    <SubBadge status={sub?.status} />
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {sub?.status === "trialing" || sub?.status === "expired"
                      ? fmtDate(sub.trial_ends_at)
                      : fmtDate(sub?.current_period_end)}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{fmtDate(s.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/studios/${s.id}`} className="text-sm font-medium text-stone-600 hover:text-stone-900">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(studios ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  Nenhum studio encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
