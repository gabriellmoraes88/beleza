import type { Metadata } from "next";
import Link from "next/link";
import { getTeam, requireStudio } from "@/lib/studio";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Alert, Field, PageHeader } from "@/components/ui";
import { addProfessional, renameProfessional, setProfessionalActive, setProfessionalServices } from "./actions";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const { supabase, studio, role } = await requireStudio();
  const team = await getTeam();
  const activeCount = team.filter((p) => p.active).length;

  // Agendamentos futuros por profissional, para avisar antes de desativar.
  const [{ data: upcoming }, { data: services }, { data: links }] = await Promise.all([
    supabase
      .from("appointments")
      .select("professional_id")
      .eq("studio_id", studio.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .limit(1000),
    supabase.from("services").select("id, name").eq("studio_id", studio.id).eq("active", true).order("sort_order").order("name"),
    supabase.from("professional_services").select("professional_id, service_id").eq("studio_id", studio.id),
  ]);
  // Sem nenhum serviço marcado = faz todos.
  const doesMap = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (!doesMap.has(l.professional_id)) doesMap.set(l.professional_id, new Set());
    doesMap.get(l.professional_id)!.add(l.service_id);
  }
  const serviceList = services ?? [];
  const future = new Map<string, number>();
  for (const a of upcoming ?? []) future.set(a.professional_id, (future.get(a.professional_id) ?? 0) + 1);

  const isOwner = role === "owner";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Equipe"
        description="Quem atende no studio e quais serviços cada uma faz. Na sua página, a cliente escolhe com quem quer agendar ou deixa “qualquer profissional”."
      />

      {!isOwner && (
        <div className="mb-5">
          <Alert>Somente a proprietária do studio pode alterar a equipe.</Alert>
        </div>
      )}

      <ul className="mb-6 space-y-3">
        {team.map((p) => {
          const pending = future.get(p.id) ?? 0;
          return (
            <li key={p.id} className={`card ${p.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-stone-600">
                    {p.active ? "Recebe agendamentos" : "Desativada: não aparece na sua página"}
                    {pending > 0 && ` · ${pending} agendamento${pending > 1 ? "s" : ""} futuro${pending > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.active && (
                    <Link href={`/painel/horarios?p=${p.id}`} className="btn-secondary px-3 py-1.5">
                      Horários
                    </Link>
                  )}
                  {isOwner && (p.active ? activeCount > 1 : true) && (
                    <form action={setProfessionalActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.active)} />
                      {p.active ? (
                        <ConfirmButton
                          className="btn-ghost px-3 py-1.5 text-rose-700"
                          message={
                            pending > 0
                              ? `${p.name} tem ${pending} agendamento(s) futuro(s), que continuam na agenda. Desativar mesmo assim?`
                              : `Desativar ${p.name}? Ela deixa de aparecer na sua página de agendamento.`
                          }
                        >
                          Desativar
                        </ConfirmButton>
                      ) : (
                        <SubmitButton className="btn-secondary px-3 py-1.5" pendingText="…">
                          Reativar
                        </SubmitButton>
                      )}
                    </form>
                  )}
                </div>
              </div>
              {serviceList.length > 0 && (() => {
                const does = doesMap.get(p.id);
                const names = serviceList.filter((sv) => !does || does.has(sv.id)).map((sv) => sv.name);
                return (
                  <details className="mt-3 border-t border-stone-100 pt-3">
                    <summary className="cursor-pointer text-sm text-stone-700">
                      <span className="font-medium">Serviços:</span>{" "}
                      {!does || names.length === serviceList.length ? "faz todos" : names.join(", ") || "nenhum"}
                    </summary>
                    {isOwner && (
                      <ActionForm action={setProfessionalServices} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={p.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {serviceList.map((sv) => (
                            <label key={sv.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="service_id"
                                value={sv.id}
                                defaultChecked={!does || does.has(sv.id)}
                                className="h-4 w-4"
                              />
                              {sv.name}
                            </label>
                          ))}
                        </div>
                        <SubmitButton className="btn-secondary">Salvar serviços</SubmitButton>
                      </ActionForm>
                    )}
                  </details>
                );
              })()}
              {isOwner && (
                <details className="mt-3 border-t border-stone-100 pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-stone-700">Alterar nome</summary>
                  <ActionForm action={renameProfessional} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input className="input" name="name" defaultValue={p.name} maxLength={80} required aria-label="Nome" />
                    <SubmitButton className="btn-secondary shrink-0">Salvar</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <div className="card">
          <h2 className="font-semibold">Adicionar profissional</h2>
          <p className="mb-3 mt-1 text-sm text-stone-600">
            Ela começa com o mesmo horário da primeira profissional. Depois é só ajustar em Horários.
          </p>
          <ActionForm action={addProfessional} className="space-y-3">
            <Field label="Nome que a cliente vai ver">
              <input className="input" name="name" maxLength={80} placeholder="Ex.: Júlia" required />
            </Field>
            <SubmitButton pendingText="Adicionando…">Adicionar à equipe</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
