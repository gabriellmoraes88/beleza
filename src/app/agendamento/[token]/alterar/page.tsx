import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { formatDateLong, formatTime, todayIn } from "@/lib/time";
import { RescheduleForm } from "./reschedule-form";

export const metadata: Metadata = { title: "Alterar horário", robots: { index: false } };

type AppointmentForChange = {
  status: string;
  starts_at: string;
  service_name: string;
  professional_name?: string | null;
  studio_name: string;
  timezone: string;
  primary_color: string;
  max_advance_days?: number;
  can_cancel: boolean;
  cancel_limit_hours: number;
};

export default async function ReschedulePage({ params }: PageProps<"/agendamento/[token]/alterar">) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_appointment", { p_token: token });
  const appt = data as AppointmentForChange | null;
  if (!appt) notFound();

  const tz = appt.timezone;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <div className="card">
        <h1 className="text-xl font-semibold">Alterar horário</h1>
        <p className="mt-1 text-sm text-stone-600">
          {appt.service_name}
          {appt.professional_name ? ` com ${appt.professional_name}` : ""} · {appt.studio_name}
        </p>
        <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm">
          Horário atual:{" "}
          <span className="font-medium capitalize">
            {formatDateLong(appt.starts_at, tz)} às {formatTime(appt.starts_at, tz)}
          </span>
        </p>

        <div className="mt-5">
          {appt.can_cancel ? (
            <RescheduleForm
              token={token}
              today={todayIn(tz)}
              days={Math.min(appt.max_advance_days ?? 60, 90)}
              timezone={tz}
              color={appt.primary_color}
            />
          ) : (
            <p className="text-sm text-stone-600">
              {appt.status === "canceled"
                ? "Este agendamento foi cancelado."
                : `Alterações online só até ${appt.cancel_limit_hours}h antes do horário. Fale com o studio.`}
            </p>
          )}
        </div>

        <Link href={`/agendamento/${token}`} className="btn-ghost mt-4 w-full">
          Voltar
        </Link>
      </div>
    </main>
  );
}
