import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/studio";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Service } from "@/lib/types";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/form";
import { ServiceForm } from "./service-form";
import { deleteService } from "./actions";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage({ searchParams }: PageProps<"/painel/servicos">) {
  const { supabase, studio } = await requireStudio();
  const { primeiro } = await searchParams;
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studio.id)
    .order("sort_order")
    .order("name");
  const services = (data ?? []) as Service[];

  return (
    <>
      <PageHeader title="Serviços" description="Cada serviço tem sua própria duração e preço." />
      {primeiro === "1" && (
        <div className="mb-4">
          <Alert tone="success">
            Studio criado! Passo 2 de 3: cadastre seus serviços. Depois, confira seus{" "}
            <Link href="/painel/horarios" className="font-semibold underline">
              horários de atendimento
            </Link>
            .
          </Alert>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {services.length === 0 ? (
            <EmptyState title="Nenhum serviço cadastrado">Cadastre o primeiro serviço ao lado.</EmptyState>
          ) : (
            services.map((s) => (
              <details key={s.id} className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.name}
                      {!s.active && <span className="ml-2 text-xs text-stone-500">(inativo)</span>}
                      {s.active && !s.is_public && <span className="ml-2 text-xs text-stone-500">(só no painel)</span>}
                    </p>
                    <p className="text-sm text-stone-600">
                      {formatDuration(s.duration_minutes)} · {formatMoney(s.price_cents)}
                    </p>
                  </div>
                  <span className="text-sm text-brand-700 group-open:hidden">Editar</span>
                </summary>
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <ServiceForm service={s} />
                  <form action={deleteService} className="mt-3">
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message="Excluir este serviço? Os agendamentos antigos continuam no histórico.">
                      Excluir serviço
                    </ConfirmButton>
                  </form>
                </div>
              </details>
            ))
          )}
        </div>
        <div className="card h-fit">
          <h2 className="mb-3 font-semibold">Novo serviço</h2>
          <ServiceForm />
        </div>
      </div>
    </>
  );
}
