"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicStudio } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/format";
import { addDays, formatLocalDate, formatTime, weekdayOf } from "@/lib/time";
import { bookAppointment, fetchSlots } from "./actions";

type Service = PublicStudio["services"][number];

const MAX_SERVICES = 5;
const WEEK_HEADER = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function monthStart(dateStr: string) {
  return `${dateStr.slice(0, 7)}-01`;
}

function shiftMonth(first: string, delta: number) {
  const [y, m] = first.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

function monthGrid(first: string): (string | null)[] {
  const [y, m] = first.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (weekdayOf(first) + 6) % 7; // semana começa na segunda
  return [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
}

export function BookingFlow({ studio, today }: { studio: PublicStudio; today: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Service[]>([]);
  const [step, setStep] = useState<"services" | "schedule">("services");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(monthStart(today));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const accent = studio.primary_color;
  const tz = studio.timezone;
  const lastDay = addDays(today, studio.max_advance_days);

  const grid = useMemo(() => monthGrid(month), [month]);
  const ids = picked.map((s) => s.id);
  const totalMinutes = picked.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalCents = picked.reduce((sum, s) => sum + s.price_cents, 0);

  function toggle(s: Service) {
    setPicked((cur) =>
      cur.some((x) => x.id === s.id)
        ? cur.filter((x) => x.id !== s.id)
        : cur.length >= MAX_SERVICES
          ? cur
          : [...cur, s],
    );
  }

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = { Manhã: [], Tarde: [], Noite: [] };
    for (const s of slots ?? []) {
      const hour = Number(formatTime(s, tz).slice(0, 2));
      groups[hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite"].push(s);
    }
    return Object.entries(groups).filter(([, list]) => list.length > 0);
  }, [slots, tz]);

  function loadSlots(serviceIds: string[], d: string) {
    setSlots(null);
    setSlot(null);
    startLoadingSlots(async () => {
      setSlots(await fetchSlots(studio.slug, serviceIds, d));
    });
  }

  function goToSchedule() {
    if (picked.length === 0) return;
    setStep("schedule");
    setError(null);
    loadSlots(ids, date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseDate(d: string) {
    if (d < today || d > lastDay) return;
    setDate(d);
    setMonth(monthStart(d));
    setError(null);
    if (ids.length > 0) loadSlots(ids, d);
  }

  function submit(formData: FormData) {
    if (ids.length === 0 || !slot) return;
    setError(null);
    startSubmitting(async () => {
      const result = await bookAppointment({
        slug: studio.slug,
        serviceIds: ids,
        startsAt: slot,
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      if (result.ok) {
        router.push(`/agendamento/${result.token}?novo=1`);
        return;
      }
      setError(result.error);
      if (result.slotTaken) loadSlots(ids, date);
    });
  }

  // Etapa 1: escolher o serviço
  if (step === "services") {
    return (
      <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_340px] lg:pb-0">
        <section className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-900">Serviços</h2>
          <p className="mb-2 text-sm text-stone-500">Você pode escolher mais de um serviço.</p>
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {studio.services.map((s) => {
              const selected = ids.includes(s.id);
              return (
                <li key={s.id} className="flex items-center gap-4 py-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">{s.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-stone-500">
                      {formatDuration(s.duration_minutes)}
                      {/* No celular o valor fica aqui, para o nome do serviço ter espaço. */}
                      {s.price_cents > 0 && <span className="text-stone-900 sm:hidden"> · {formatMoney(s.price_cents)}</span>}
                    </p>
                    {s.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{s.description}</p>}
                  </div>
                  {s.price_cents > 0 && (
                    <p className="hidden shrink-0 text-right sm:block">
                      <span className="block text-xs text-stone-500">Valor</span>
                      <span className="font-semibold text-stone-900">{formatMoney(s.price_cents)}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    disabled={!selected && picked.length >= MAX_SERVICES}
                    className={`btn shrink-0 border ${
                      selected
                        ? "border-transparent text-white"
                        : "border-stone-300 bg-white text-stone-900 hover:border-stone-900"
                    }`}
                    style={selected ? { backgroundColor: accent } : undefined}
                    aria-pressed={selected}
                  >
                    {selected ? "Adicionado" : "Adicionar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Resumo (computador) */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl border border-stone-200 bg-white">
            <div className="min-h-32 p-5">
              {picked.length > 0 ? (
                <ul className="space-y-3">
                  {picked.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-stone-900">{s.name}</p>
                        <p className="text-sm text-stone-500">
                          {formatDuration(s.duration_minutes)}
                          {s.price_cents > 0 && ` · ${formatMoney(s.price_cents)}`}
                        </p>
                      </div>
                      <button type="button" onClick={() => toggle(s)} className="text-sm text-stone-500 underline">
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-stone-600">Nenhum serviço escolhido. Adicione serviços para começar.</p>
              )}
            </div>
            <div className="border-t border-stone-200 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-stone-700">Total</span>
                <span className="text-lg font-semibold text-stone-900">{formatMoney(totalCents)}</span>
              </div>
              {totalMinutes > 0 && (
                <p className="-mt-3 mb-4 text-right text-sm text-stone-500">Duração total: {formatDuration(totalMinutes)}</p>
              )}
              <button
                type="button"
                onClick={goToSchedule}
                disabled={picked.length === 0}
                className="btn w-full py-3 text-white"
                style={{ backgroundColor: accent }}
              >
                Escolher horário
              </button>
              <p className="mt-3 text-center text-xs text-stone-500">Sem pagamento online. Você paga no studio.</p>
            </div>
          </div>
        </aside>

        {/* Resumo (celular) */}
        {picked.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">
                  {picked.length === 1 ? picked[0].name : `${picked.length} serviços`}
                </p>
                <p className="text-sm text-stone-500">
                  {formatDuration(totalMinutes)}
                  {totalCents > 0 && ` · ${formatMoney(totalCents)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={goToSchedule}
                className="btn shrink-0 text-white"
                style={{ backgroundColor: accent }}
              >
                Escolher horário
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Etapa 2: data, horário e dados da cliente
  const canPrev = month > monthStart(today);
  const canNext = shiftMonth(month, 1) <= lastDay;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="min-w-0">
        <button type="button" onClick={() => setStep("services")} className="btn-secondary mb-5 rounded-full">
          ‹ Voltar
        </button>
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Data e horário do agendamento</h2>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Calendário */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-stone-800 first-letter:uppercase">{formatLocalDate(month, { month: "long", year: "numeric" }).replace(" de ", " ")}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  disabled={!canPrev}
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  className="rounded-full px-2 py-1 text-lg text-stone-700 disabled:text-stone-300"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  disabled={!canNext}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  className="rounded-full px-2 py-1 text-lg text-stone-700 disabled:text-stone-300"
                >
                  ›
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK_HEADER.map((w) => (
                <span key={w} className="py-1 text-xs font-medium text-stone-500">
                  {w}
                </span>
              ))}
              {grid.map((d, i) => {
                if (!d) return <span key={`vazio-${i}`} />;
                const enabled = d >= today && d <= lastDay;
                const selected = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!enabled}
                    onClick={() => chooseDate(d)}
                    aria-pressed={selected}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                      selected
                        ? "font-semibold text-white"
                        : enabled
                          ? "bg-stone-100 font-medium text-stone-900 hover:bg-stone-200"
                          : "text-stone-300 line-through"
                    }`}
                    style={selected ? { backgroundColor: accent } : undefined}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horários */}
          <div>
            <p className="mb-3 text-center font-medium text-stone-900">Selecione a hora</p>
            <div className="min-h-48 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              {loadingSlots || slots === null ? (
                <p className="py-12 text-center text-sm text-stone-500">Carregando horários…</p>
              ) : grouped.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-stone-600">Nenhum horário disponível para a data selecionada.</p>
                  {addDays(date, 1) <= lastDay && (
                    <button
                      type="button"
                      onClick={() => chooseDate(addDays(date, 1))}
                      className="mt-3 text-sm font-medium text-stone-900 underline"
                    >
                      Ver o dia seguinte →
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map(([label, list]) => (
                    <div key={label}>
                      <p className="mb-1.5 text-xs text-stone-500">{label}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {list.map((s) => {
                          const selected = s === slot;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSlot(s)}
                              className={`rounded-lg border py-2 text-sm font-medium transition ${
                                selected
                                  ? "border-transparent text-white"
                                  : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
                              }`}
                              style={selected ? { backgroundColor: accent } : undefined}
                              aria-pressed={selected}
                            >
                              {formatTime(s, tz)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Resumo e dados da cliente */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <p className="text-lg font-semibold text-stone-900">{studio.name}</p>
          <dl className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm">
            <dt className="text-xs font-medium uppercase text-stone-500">Data</dt>
            <dt className="text-xs font-medium uppercase text-stone-500">Horário</dt>
            <dt className="text-xs font-medium uppercase text-stone-500">Duração</dt>
            <dd className="text-stone-800 first-letter:uppercase">
              {formatLocalDate(date, { weekday: "long", day: "numeric", month: "long" })}
            </dd>
            <dd className="text-stone-800">{slot ? formatTime(slot, tz) : "-"}</dd>
            <dd className="text-stone-800">{formatDuration(totalMinutes)}</dd>
          </dl>
        </div>

        <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200">
          {picked.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">{s.name}</p>
                <p className="text-xs text-stone-500">{formatDuration(s.duration_minutes)}</p>
              </div>
              {s.price_cents > 0 && <p className="text-sm text-stone-900">{formatMoney(s.price_cents)}</p>}
            </li>
          ))}
          {picked.length > 1 && (
            <li className="flex justify-between px-4 py-3 text-sm font-semibold text-stone-900">
              <span>Total</span>
              <span>{formatMoney(totalCents)}</span>
            </li>
          )}
        </ul>
        <button type="button" onClick={() => setStep("services")} className="btn-secondary w-full rounded-full">
          Adicionar mais serviços
        </button>

        <form action={submit} className="space-y-3 border-t border-stone-200 pt-4">
          <label className="block">
            <span className="label">Seu nome</span>
            <input className="input" name="name" autoComplete="name" required minLength={2} maxLength={80} />
          </label>
          <label className="block">
            <span className="label">WhatsApp / telefone</span>
            <input
              className="input"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-0000"
              required
            />
          </label>
          <label className="block">
            <span className="label">Observação (opcional)</span>
            <textarea className="input" name="note" rows={2} maxLength={500} />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn w-full py-3 text-base text-white"
            style={{ backgroundColor: accent }}
            disabled={!slot || submitting}
          >
            {submitting ? "Agendando…" : slot ? "Confirmar agendamento" : "Escolha um horário"}
          </button>
          <p className="text-center text-xs text-stone-500">
            Sem cadastro e sem pagamento online. Usamos seu nome e telefone apenas para este agendamento com{" "}
            {studio.name}.
          </p>
        </form>
      </aside>
    </div>
  );
}
