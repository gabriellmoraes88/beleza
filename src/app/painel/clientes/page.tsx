import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/studio";
import { formatPhone } from "@/lib/phone";
import { formatLocalDate, toLocalDate } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clientes" };

type Row = {
  id: string;
  name: string;
  phone: string;
  customer_stats: { total_appointments: number; last_visit_at: string | null; next_visit_at: string | null }[] | null;
};

export default async function CustomersPage({ searchParams }: PageProps<"/painel/clientes">) {
  const { supabase, studio } = await requireStudio();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 60) : "";

  // Os dados vêm da view customer_stats (respeita RLS).
  let query = supabase
    .from("customers")
    .select("id, name, phone")
    .eq("studio_id", studio.id)
    .order("name")
    .limit(200);
  if (search) {
    const digits = search.replace(/\D/g, "");
    query = digits.length >= 4 ? query.like("phone", `%${digits}%`) : query.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
  }
  const { data: customers } = await query;
  const ids = (customers ?? []).map((c) => c.id);
  const { data: stats } = ids.length
    ? await supabase.from("customer_stats").select("*").in("customer_id", ids)
    : { data: [] };
  const statsById = new Map((stats ?? []).map((s) => [s.customer_id as string, s]));
  const rows: Row[] = (customers ?? []).map((c) => ({ ...c, customer_stats: statsById.has(c.id) ? [statsById.get(c.id)] : null }));
  const tz = studio.timezone;

  return (
    <>
      <PageHeader title="Clientes" description="Cadastradas automaticamente quando agendam." />
      <form className="mb-4 flex gap-2">
        <input className="input" name="q" defaultValue={search} placeholder="Buscar por nome ou telefone" />
        <button className="btn-secondary">Buscar</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={search ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"}>
          {!search && "Assim que alguém agendar pelo seu link, ela aparece aqui."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {rows.map((c) => {
            const s = c.customer_stats?.[0];
            return (
              <li key={c.id}>
                <Link href={`/painel/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-sm text-stone-600">{formatPhone(c.phone)}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-stone-500">
                    <p>{s?.total_appointments ?? 0} agendamento(s)</p>
                    {s?.next_visit_at ? (
                      <p className="text-brand-700">
                        Próximo: {formatLocalDate(toLocalDate(new Date(s.next_visit_at), tz), { day: "2-digit", month: "2-digit" })}
                      </p>
                    ) : s?.last_visit_at ? (
                      <p>
                        Última: {formatLocalDate(toLocalDate(new Date(s.last_visit_at), tz), { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
