import type { Metadata } from "next";
import Link from "next/link";
import { requireStudio } from "@/lib/studio";
import { SITE_URL } from "@/lib/env";
import type { Appointment } from "@/lib/types";
import { dayRangeUtc, formatDateLong, formatTime, todayIn } from "@/lib/time";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ShareLink } from "@/components/share-link";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  const { supabase, studio } = await requireStudio();
  const tz = studio.timezone;
  const today = todayIn(tz);
  const [dayStart, dayEnd] = dayRangeUtc(today, tz);

  const [{ data: todayData }, { data: upcomingData }, { data: services }, { count: hoursCount }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, customers(id, name, phone)")
      .eq("studio_id", studio.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("*, customers(id, name, phone)")
      .eq("studio_id", studio.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", dayEnd.toISOString())
      .order("starts_at")
      .limit(5),
    supabase.from("services").select("id, duration_minutes, is_public").eq("studio_id", studio.id).eq("active", true),
    supabase.from("working_hours").select("id", { count: "exact", head: true }).eq("studio_id", studio.id),
  ]);

  const todayAppts = (todayData ?? []) as Appointment[];
  const upcoming = (upcomingData ?? []) as Appointment[];
  const active = todayAppts.filter((a) => a.status !== "canceled");
  const canceled = todayAppts.filter((a) => a.status === "canceled");
  const pending = todayAppts.filter((a) => a.status === "pending").length + upcoming.filter((a) => a.status === "pending").length;

  // Horários livres hoje, considerando o serviço mais curto.
  const shortest = Math.min(...(services ?? []).map((s) => s.duration_minutes));
  let freeSlots: number | null = null;
  if (Number.isFinite(shortest)) {
    const { data } = await supabase.rpc("studio_available_slots", {
      p_studio_id: studio.id,
      p_duration_minutes: shortest,
      p_date: today,
    });
    freeSlots = Array.isArray(data) ? data.length : 0;
  }

  const checklist = [
    { done: (services ?? []).some((s) => s.is_public), label: "Cadastrar serviços", href: "/painel/servicos" },
    { done: (hoursCount ?? 0) > 0, label: "Conferir horários de atendimento", href: "/painel/horarios" },
    { done: !!(studio.address || studio.description), label: "Completar informações públicas", href: "/painel/configuracoes" },
    { done: !!studio.onboarding_completed_at, label: "Revisar endereço do link e regras", href: "/painel/configuracoes" },
  ];
  const pendingSteps = checklist.filter((c) => !c.done);
  const url = `${SITE_URL()}/s/${studio.slug}`;

  return (
    <>
      <div className="mb-5">
        <p className="text-sm capitalize text-stone-500">{formatDateLong(new Date(), tz)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Olá{studio.owner_name ? `, ${studio.owner_name.split(" ")[0]}` : ""}!</h1>
      </div>

      {pendingSteps.length > 0 && (
        <div className="card mb-5 border-brand-100 bg-brand-50/50">
          <h2 className="font-semibold">Falta pouco para começar</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    c.done ? "bg-emerald-500 text-white" : "border border-stone-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {c.done ? "✓" : ""}
                </span>
                {c.done ? (
                  <span className="text-stone-500 line-through">{c.label}</span>
                ) : (
                  <Link href={c.href} className="font-medium text-brand-700 hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Agendamentos hoje", value: active.length },
          { label: "Horários livres hoje", value: freeSlots ?? "—" },
          { label: "Cancelamentos hoje", value: canceled.length },
          { label: "Aguardando confirmação", value: pending },
        ].map((s) => (
          <div key={s.label} className="card py-3">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/painel/agenda" className="btn-primary">
          + Novo agendamento
        </Link>
        <Link href="/painel/servicos" className="btn-secondary">
          Cadastrar serviço
        </Link>
        <Link href="/painel/horarios" className="btn-secondary">
          Bloquear horário
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Hoje</h2>
          {todayAppts.length === 0 ? (
            <EmptyState title="Nenhum agendamento hoje">Compartilhe seu link para receber agendamentos.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {todayAppts.map((a) => (
                <li key={a.id}>
                  <Link href={`/painel/agenda?view=dia&data=${today}`} className="card flex items-center gap-3 py-3 hover:border-stone-300">
                    <span className="w-12 font-semibold">{formatTime(a.starts_at, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.customers?.name}</span>
                      <span className="block truncate text-sm text-stone-600">{a.service_name}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-5">
          <div>
            <h2 className="mb-2 font-semibold">Próximos atendimentos</h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Nada agendado para os próximos dias" />
            ) : (
              <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.customers?.name}</p>
                      <p className="truncate capitalize text-stone-600">
                        {formatDateLong(a.starts_at, tz)} · {formatTime(a.starts_at, tz)} · {a.service_name}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/painel/agenda?view=lista" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="card">
            <h2 className="mb-3 font-semibold">Compartilhe seu link</h2>
            <ShareLink url={url} studioName={studio.name} />
          </div>
        </section>
      </div>
    </>
  );
}
