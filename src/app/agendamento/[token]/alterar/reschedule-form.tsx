"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, formatLocalDate, formatTime } from "@/lib/time";
import { fetchRescheduleSlots, reschedule } from "../actions";

export function RescheduleForm({
  token,
  today,
  days,
  timezone,
  color,
}: {
  token: string;
  today: string;
  days: number;
  timezone: string;
  color: string;
}) {
  const router = useRouter();
  const dates = useMemo(() => Array.from({ length: days + 1 }, (_, i) => addDays(today, i)), [today, days]);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let alive = true;
    fetchRescheduleSlots(token, date).then((s) => alive && setSlots(s));
    return () => {
      alive = false;
    };
  }, [token, date]);

  function chooseDate(d: string) {
    setDate(d);
    setSlots(null);
    setSlot(null);
    setError(null);
  }

  function confirm() {
    if (!slot) return;
    setError(null);
    startSaving(async () => {
      const result = await reschedule(token, slot);
      if (result.ok) {
        router.push(`/agendamento/${token}?alterado=1`);
        return;
      }
      setError(result.error);
      if (result.slotTaken) {
        setSlot(null);
        setSlots(await fetchRescheduleSlots(token, date));
      }
    });
  }

  return (
    <div className="text-left">
      <p className="mb-2 text-sm font-medium text-stone-700">Escolha o dia</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {dates.map((d) => {
          const selected = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => chooseDate(d)}
              aria-pressed={selected}
              className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition ${
                selected ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
              }`}
              style={selected ? { backgroundColor: color } : undefined}
            >
              <span className="text-[11px] uppercase opacity-80">
                {formatLocalDate(d, { weekday: "short" }).replace(".", "")}
              </span>
              <span className="text-lg font-semibold">{Number(d.slice(8))}</span>
              <span className="text-[11px] opacity-80">{formatLocalDate(d, { month: "short" }).replace(".", "")}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-2 text-sm font-medium text-stone-700">Escolha o novo horário</p>
      <div className="min-h-32 rounded-2xl border border-stone-200 bg-stone-50 p-3">
        {slots === null ? (
          <p className="py-10 text-center text-sm text-stone-500">Carregando horários…</p>
        ) : slots.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-600">Nenhum horário livre neste dia.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const selected = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  aria-pressed={selected}
                  className={`rounded-lg border py-2 text-sm font-medium transition ${
                    selected ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
                  }`}
                  style={selected ? { backgroundColor: color } : undefined}
                >
                  {formatTime(s, timezone)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={!slot || saving}
        className="btn mt-4 w-full py-3 text-white"
        style={{ backgroundColor: color }}
      >
        {saving
          ? "Alterando…"
          : slot
            ? `Mudar para ${formatLocalDate(date, { weekday: "short", day: "numeric", month: "short" })} às ${formatTime(slot, timezone)}`
            : "Escolha um horário"}
      </button>
    </div>
  );
}
