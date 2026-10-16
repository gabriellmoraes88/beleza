import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/studio";
import type { Appointment } from "@/lib/types";
import {
  WEEKDAYS_SHORT,
  addDays,
  dayRangeUtc,
  daysFromNow,
  formatLocalDate,
  formatTime,
  isValidDateStr,
  startOfWeek,
  toLocalDate,
  todayIn,
} from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";
import { AppointmentCard } from "./appointment-card";
import { NewAppointmentForm } from "./new-appointment-form";

export const metadata: Metadata = { title: "Agenda" };

const VIEWS = { dia: "Dia", semana: "Semana", lista: "Próximos" } as const;
type View = keyof typeof VIEWS;

export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  const { supabase, studio } = await requireStudio();
  const sp = await searchParams;
  const tz = studio.timezone;
  const today = todayIn(tz);
  const view: View = sp.view === "semana" || sp.view === "lista" ? sp.view : "dia";
  const date = typeof sp.data === "string" && isValidDateStr(sp.data) ? sp.data : today;

  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "dia") {
    [rangeStart, rangeEnd] = dayRangeUtc(date, tz);
  } else if (view === "semana") {
    const ws = startOfWeek(date);
    rangeStart = dayRangeUtc(ws, tz)[0];
    rangeEnd = dayRangeUtc(addDays(ws, 6), tz)[1];
  } else {
    rangeStart = new Date();
    rangeEnd = daysFromNow(365);
  }

  let query = supabase
    .from("appointments")
    .select("*, customers(id, name, phone)")
    .eq("studio_id", studio.id)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");
  if (view === "lista") query = query.in("status", ["pending", "confirmed"]).limit(100);

  const [{ data }, { data: blocks }, { data: services }] = await Promise.all([
    query,
    supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("studio_id", studio.id)
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString())
      .order("starts_at"),
    supabase.from("services").select("id, name, duration_minutes").eq("studio_id", studio.id).eq("active", true).order("name"),
  ]);
  const appointments = (data ?? []) as Appointment[];

  const step = view === "semana" ? 7 : 1;
  const link = (v: View, d: string) => `/painel/agenda?view=${v}&data=${d}`;

  return (
    <>
      <PageHeader title="Agenda" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link
              key={v}
              href={link(v, date)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                v === view ? "bg-brand-600 text-white" : "text-stone-700"
              }`}
            >
              {VIEWS[v]}
            </Link>
          ))}
        </div>
        {view !== "lista" && (
          <div className="flex items-center gap-1">
            <Link href={link(view, addDays(date, -step))} className="btn-secondary px-3" aria-label="Anterior">
              ‹
            </Link>
            <Link href={link(view, today)} className="btn-secondary px-3">
              Hoje
            </Link>
            <Link href={link(view, addDays(date, step))} className="btn-secondary px-3" aria-label="Próximo">
              ›
            </Link>
            <form action="/painel/agenda" className="ml-1 flex gap-1">
              <input type="hidden" name="view" value={view} />
              <input type="date" name="data" defaultValue={date} className="input w-auto py-1.5" aria-label="Ir para data" />
              <button className="btn-secondary px-3">Ir</button>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          {view === "dia" && (
            <>
              <h2 className="mb-3 font-medium capitalize text-stone-700">
                {formatLocalDate(date, { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              {blocks && blocks.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {blocks.map((b) => (
                    <li key={b.id} className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
                      Bloqueado {formatTime(b.starts_at, tz)}–{formatTime(b.ends_at, tz)}
                      {b.reason && ` · ${b.reason}`}
                    </li>
                  ))}
                </ul>
              )}
              {appointments.length === 0 ? (
                <EmptyState title="Nenhum agendamento neste dia" />
              ) : (
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <AppointmentCard key={a.id} appt={a} timeZone={tz} />
                  ))}
                </div>
              )}
            </>
          )}

          {view === "semana" && (
            <div className="grid gap-3 md:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)).map((d) => {
                const dayAppts = appointments.filter((a) => toLocalDate(new Date(a.starts_at), tz) === d);
                return (
                  <div key={d} className={`rounded-2xl border bg-white p-2 ${d === today ? "border-brand-500" : "border-stone-200"}`}>
                    <Link href={link("dia", d)} className="mb-2 block text-center text-sm font-medium hover:underline">
                      {WEEKDAYS_SHORT[new Date(`${d}T12:00:00Z`).getUTCDay()]} {d.slice(8)}/{d.slice(5, 7)}
                    </Link>
                    {dayAppts.length === 0 ? (
                      <p className="py-2 text-center text-xs text-stone-400">Livre</p>
                    ) : (
                      <ul className="space-y-1">
                        {dayAppts.map((a) => (
                          <li key={a.id}>
                            <Link
                              href={link("dia", d)}
                              className={`block rounded-lg px-2 py-1 text-xs ${
                                a.status === "canceled"
                                  ? "bg-stone-100 text-stone-400 line-through"
                                  : a.status === "pending"
                                    ? "bg-amber-50 text-amber-900"
                                    : "bg-brand-50 text-brand-700"
                              }`}
                            >
                              <span className="font-semibold">{formatTime(a.starts_at, tz)}</span>{" "}
                              {a.customers?.name?.split(" ")[0]}
                              <span className="block truncate opacity-80">{a.service_name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === "lista" &&
            (appointments.length === 0 ? (
              <EmptyState title="Nenhum agendamento futuro" />
            ) : (
              <div className="space-y-2">
                {appointments.map((a) => (
                  <AppointmentCard key={a.id} appt={a} timeZone={tz} showDate />
                ))}
              </div>
            ))}
        </div>

        <aside className="card h-fit">
          <h2 className="mb-3 font-semibold">Novo agendamento</h2>
          <NewAppointmentForm services={services ?? []} defaultDate={date < today ? today : date} />
        </aside>
      </div>
    </>
  );
}
