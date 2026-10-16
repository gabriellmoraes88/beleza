import type { Metadata } from "next";
import { requireStudio } from "@/lib/studio";
import { WEEKDAYS, formatDateLong, formatTime, todayIn } from "@/lib/time";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/ui";
import { deleteBlock, saveWorkingHours } from "./actions";
import { BlockForm } from "./block-form";

export const metadata: Metadata = { title: "Horários" };

type Hour = { weekday: number; start_time: string; end_time: string };

export default async function HoursPage() {
  const { supabase, studio, professional } = await requireStudio();
  const [{ data: hoursData }, { data: blocks }] = await Promise.all([
    supabase
      .from("working_hours")
      .select("weekday, start_time, end_time")
      .eq("professional_id", professional?.id ?? "")
      .order("start_time"),
    supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason")
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
        description="Defina seus dias e horários. Use o segundo intervalo para a pausa do almoço."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <ActionForm action={saveWorkingHours} className="card space-y-3">
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
          <SubmitButton>Salvar horários</SubmitButton>
        </ActionForm>

        <div className="space-y-5">
          <div className="card">
            <h2 className="mb-1 font-semibold">Bloquear horário</h2>
            <p className="mb-3 text-sm text-stone-600">Compromissos, folgas, férias e feriados.</p>
            <BlockForm defaultDate={todayIn(tz)} />
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
