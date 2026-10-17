"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";

type Total = { cents: number; count: number };

/** Valor previsto de hoje e da semana; a troca de aba é instantânea, sem recarregar a página. */
export function ForecastCard({ day, week, today }: { day: Total; week: Total; today: string }) {
  const [isWeek, setIsWeek] = useState(false);
  const total = isWeek ? week : day;
  return (
    <div className="card mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Previsto</h2>
        <div className="flex rounded-full bg-stone-100 p-1 text-sm" role="tablist">
          {[
            { label: "Hoje", on: !isWeek, value: false },
            { label: "Esta semana", on: isWeek, value: true },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={t.on}
              onClick={() => setIsWeek(t.value)}
              className={`rounded-full px-3 py-1 font-medium ${t.on ? "bg-white shadow-sm" : "text-stone-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{formatMoney(total.cents)}</p>
      <p className="text-sm text-stone-600">
        {total.count === 1 ? "1 atendimento" : `${total.count} atendimentos`} {isWeek ? "de domingo a sábado" : "hoje"}
        {" · "}
        <Link
          href={`/painel/agenda?view=${isWeek ? "semana" : "dia"}&data=${today}`}
          className="font-medium text-brand-700 hover:underline"
        >
          Ver na agenda
        </Link>
      </p>
    </div>
  );
}
