import type { Metadata } from "next";
import Link from "next/link";
import { getTeam, requireStudio } from "@/lib/studio";
import { WEEKDAYS, formatDateLong, formatTime, todayIn } from "@/lib/time";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/ui";
import { deleteBlock, saveWorkingHours } from "./actions";
import { BlockForm } from "./block-form";

export const metadata: Metadata = { title: "Horários" };

type Hour = { weekday: number; start_time: string; end_time: string };

export default async function HoursPage({ searchParams }: PageProps<"/painel/horarios">) {
  const { supabase, studio } = await requireStudio();
  const sp = await searchParams;
  const team = (await getTeam()).filter((p) => p.active);
  const professional = team.find((p) => p.id === sp.p) ?? team[0] ?? null;
  const multi = team.length > 1;
  const [{ data: hoursData }, { data: blocks }] = await Promise.all([
    supabase
      .from("working_hours")
      .select("weekday, start_time, end_time")
      .eq("professional_id", professional?.id ?? "")
      .order("start_time"),
    supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason, professionals(name)")
      .eq("studio_id", studio.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(50),
  ]);
  const hours = (hoursData ?? []) as Hour[];
  const tz = studio.timezone;

  // Exibe a semana começando na segunda.
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <PageHeader
        title="Horários de atendimento"
        description="Defina os dias e horários. Use o segundo intervalo para a pausa do almoço."
        actions={
          <Link href="/painel/equipe" className="btn-secondary">
            {multi ? "Gerenciar equipe" : "Adicionar profissional"}
          </Link>
        }
      />
      {multi && professional && (
        <nav aria-label="Profissional" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {team.map((p) => (
            <Link
              key={p.id}
              href={`/painel/horarios?p=${p.id}`}
              aria-current={p.id === professional.id ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                p.id === professional.id
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <ActionForm key={professional?.id} action={saveWorkingHours} className="card space-y-3">
          {professional && <input type="hidden" name="professional_id" value={professional.id} />}
          {multi && professional && <p className="font-semibold">Horário de {professional.name}</p>}
          {order.map((d) => {
            const day = hours.filter((h) => h.weekday === d);
            const open = day.length > 0;
            const [a, b] = day;
            return (
              <fieldset key={d} className="rounded-xl border border-stone-200 p-3">
                <legend className="sr-only">{WEEKDAYS[d]}</legend>
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" name={`open_${d}`} defaultChecked={open} className="h-4 w-4" />
                  {WEEKDAYS[d]}
                </label>
                <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                  <span className="text-stone-500">das</span>
                  <input className="input px-2.5 py-1.5" type="time" name={`start1_${d}`} defaultValue={a?.start_time?.slice(0, 5) ?? "09:00"} />
                  <span className="text-stone-500">às</span>
                  <input className="input px-2.5 py-1.5" type="time" name={`end1_${d}`} defaultValue={a?.end_time?.slice(0, 5) ?? "12:00"} />
                  <span className="text-stone-500">das</span>
                  <input className="input px-2.5 py-1.5" type="time" name={`start2_${d}`} defaultValue={b?.start_time?.slice(0, 5) ?? (open ? "" : "13:00")} />
                  <span className="text-stone-500">às</span>
                  <input className="input px-2.5 py-1.5" type="time" name={`end2_${d}`} defaultValue={b?.end_time?.slice(0, 5) ?? (open ? "" : "19:00")} />
                </div>
              </fieldset>
            );
          })}
          <p className="text-xs text-stone-500">
            Dias desmarcados ficam fechados. Deixe o segundo intervalo vazio se não houver pausa.
          </p>
          <SubmitButton>{multi && professional ? `Salvar horário de ${professional.name}` : "Salvar horários"}</SubmitButton>
        </ActionForm>

        <div className="space-y-5">
          <div className="card">
            <h2 className="mb-1 font-semibold">Bloquear horário</h2>
            <p className="mb-3 text-sm text-stone-600">Compromissos, folgas, férias e feriados.</p>
            <BlockForm defaultDate={todayIn(tz)} team={multi ? team : []} defaultProfessional={professional?.id} />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Próximos bloqueios</h2>
            {!blocks?.length ? (
              <EmptyState title="Nenhum bloqueio" />
            ) : (
              <ul className="space-y-2">
                {blocks.map((b) => (
                  <li key={b.id} className="card flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium capitalize">{formatDateLong(b.starts_at, tz)}</p>
                      <p className="text-stone-600">
                        {formatTime(b.starts_at, tz)} até{" "}
                        {formatDateLong(b.ends_at, tz) === formatDateLong(b.starts_at, tz)
                          ? formatTime(b.ends_at, tz)
                          : `${formatDateLong(b.ends_at, tz)} ${formatTime(b.ends_at, tz)}`}
                        {b.reason && ` · ${b.reason}`}
                      </p>
                      <p className="text-xs text-stone-500">
                        {(Array.isArray(b.professionals) ? b.professionals[0] : b.professionals)?.name ?? (multi ? "Studio inteiro" : "")}
                      </p>
                    </div>
                    <form action={deleteBlock}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton message="Remover este bloqueio?" className="btn-ghost text-rose-700">
                        Remover
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
