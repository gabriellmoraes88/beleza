"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicStudio } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/format";
import { addDays, formatLocalDate, formatTime, toLocalDate } from "@/lib/time";
import { bookAppointment, fetchSlots } from "./actions";

type Service = PublicStudio["services"][number];

export function BookingFlow({ studio, today }: { studio: PublicStudio; today: string }) {
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const accent = studio.primary_color;
  const tz = studio.timezone;

  const days = useMemo(() => {
    const total = Math.min(studio.max_advance_days, 30);
    return Array.from({ length: total + 1 }, (_, i) => addDays(today, i));
  }, [today, studio.max_advance_days]);

  function loadSlots(serviceId: string, d: string) {
    setSlots(null);
    setSlot(null);
    startLoadingSlots(async () => {
      setSlots(await fetchSlots(studio.slug, serviceId, d));
    });
  }

  function chooseService(s: Service) {
    setService(s);
    setError(null);
    loadSlots(s.id, date);
  }

  function chooseDate(d: string) {
    setDate(d);
    setError(null);
    if (service) loadSlots(service.id, d);
  }

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = { Manhã: [], Tarde: [], Noite: [] };
    for (const s of slots ?? []) {
      const hour = Number(formatTime(s, tz).slice(0, 2));
      groups[hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite"].push(s);
    }
    return Object.entries(groups).filter(([, list]) => list.length > 0);
  }, [slots, tz]);

  function submit(formData: FormData) {
    if (!service || !slot) return;
    setError(null);
    startSubmitting(async () => {
      const result = await bookAppointment({
        slug: studio.slug,
        serviceId: service.id,
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
      if (result.slotTaken) loadSlots(service.id, date);
    });
  }

  // Etapa 1: serviço
  if (!service) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Serviços</h2>
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {studio.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="font-medium text-stone-900">{s.name}</p>
                {s.description && <p className="mt-0.5 text-sm text-stone-600">{s.description}</p>}
                <p className="mt-1 text-sm text-stone-500">
                  {formatDuration(s.duration_minutes)}
                  {s.price_cents > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-stone-900">{formatMoney(s.price_cents)}</span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => chooseService(s)}
                className="btn shrink-0 border border-stone-300 bg-white text-stone-900 hover:border-stone-900"
              >
                Agendar
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Serviço</p>
          <p className="font-medium">{service.name}</p>
          <p className="text-sm text-stone-600">
            {formatDuration(service.duration_minutes)}
            {service.price_cents > 0 && ` · ${formatMoney(service.price_cents)}`}
          </p>
        </div>
        <button type="button" className="text-sm font-medium underline" onClick={() => setService(null)}>
          Trocar
        </button>
      </div>

      {/* Etapa 2: data */}
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Escolha o dia</p>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {days.map((d) => {
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                onClick={() => chooseDate(d)}
                className={`flex w-14 shrink-0 snap-start flex-col items-center rounded-xl border py-2 text-sm transition ${
                  selected ? "border-transparent text-white" : "border-stone-200 text-stone-700"
                }`}
                style={selected ? { backgroundColor: accent } : undefined}
                aria-pressed={selected}
              >
                <span className="text-xs capitalize">
                  {d === today ? "Hoje" : formatLocalDate(d, { weekday: "short" }).replace(".", "")}
                </span>
                <span className="text-lg font-semibold">{d.slice(8)}</span>
                <span className="text-[10px] capitalize opacity-80">
                  {formatLocalDate(d, { month: "short" }).replace(".", "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Etapa 3: horário */}
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Escolha o horário</p>
        {loadingSlots || slots === null ? (
          <p className="py-4 text-center text-sm text-stone-500">Carregando horários…</p>
        ) : grouped.length === 0 ? (
          <p className="rounded-xl bg-stone-50 py-4 text-center text-sm text-stone-600">
            Nenhum horário livre neste dia. Tente outra data.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([label, list]) => (
              <div key={label}>
                <p className="mb-1.5 text-xs text-stone-500">{label}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {list.map((s) => {
                    const selected = s === slot;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={`rounded-lg border py-2 text-sm font-medium transition ${
                          selected ? "border-transparent text-white" : "border-stone-200 text-stone-800"
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

      {/* Etapa 4: dados */}
      {slot && (
        <form action={submit} className="space-y-3 border-t border-stone-100 pt-4">
          <p className="text-sm text-stone-700">
            <span className="capitalize">{formatLocalDate(toLocalDate(new Date(slot), tz), { weekday: "long", day: "numeric", month: "long" })}</span>{" "}
            às <strong>{formatTime(slot, tz)}</strong>
          </p>
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
            disabled={submitting}
          >
            {submitting ? "Agendando…" : "Confirmar agendamento"}
          </button>
          <p className="text-center text-xs text-stone-500">
            Usamos seu nome e telefone apenas para este agendamento com {studio.name}.
          </p>
        </form>
      )}
      {!slot && error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
    </section>
  );
}
