import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/studio";
import { formatMoney } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader, StatusBadge } from "@/components/ui";
import { updateCustomer } from "../actions";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: PageProps<"/painel/clientes/[id]">) {
  const { id } = await params;
  const { supabase, studio } = await requireStudio();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [{ data: customer }, { data: history }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, service_name, price_cents")
      .eq("customer_id", id)
      .eq("studio_id", studio.id)
      .order("starts_at", { ascending: false })
      .limit(100),
  ]);
  if (!customer) notFound();
  const tz = studio.timezone;
  const done = (history ?? []).filter((h) => h.status === "completed");

  return (
    <>
      <Link href="/painel/clientes" className="mb-2 inline-block text-sm text-stone-600 hover:underline">
        ‹ Clientes
      </Link>
      <PageHeader
        title={customer.name}
        description={`${formatPhone(customer.phone)} · cliente desde ${
          customer.first_booking_at ? formatDateLong(customer.first_booking_at, tz) : "—"
        }`}
        actions={
          <a href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer" className="btn-secondary">
            WhatsApp
          </a>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="card py-3">
              <p className="text-xl font-semibold">{(history ?? []).filter((h) => h.status !== "canceled").length}</p>
              <p className="text-xs text-stone-500">Agendamentos</p>
            </div>
            <div className="card py-3">
              <p className="text-xl font-semibold">{done.length}</p>
              <p className="text-xs text-stone-500">Concluídos</p>
            </div>
            <div className="card py-3">
              <p className="text-xl font-semibold">{(history ?? []).filter((h) => h.status === "no_show").length}</p>
              <p className="text-xs text-stone-500">Faltas</p>
            </div>
          </div>
          <h2 className="mb-2 font-semibold">Histórico</h2>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{h.service_name}</p>
                  <p className="capitalize text-stone-600">
                    {formatDateLong(h.starts_at, tz)} · {formatTime(h.starts_at, tz)}
                    {h.price_cents > 0 && ` · ${formatMoney(h.price_cents)}`}
                  </p>
                </div>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        </div>
        <ActionForm action={updateCustomer} className="card h-fit space-y-3">
          <input type="hidden" name="id" value={customer.id} />
          <Field label="Nome">
            <input className="input" name="name" defaultValue={customer.name} required />
          </Field>
          <Field label="Observações internas" hint="Só você vê. Evite dados sensíveis desnecessários.">
            <textarea className="input" name="notes" rows={4} maxLength={1000} defaultValue={customer.notes ?? ""} />
          </Field>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
