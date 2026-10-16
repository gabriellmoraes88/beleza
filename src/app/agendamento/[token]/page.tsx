import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { formatMoney } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/time";
import { StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/form";

export const metadata: Metadata = { title: "Seu agendamento", robots: { index: false } };

type PublicAppointment = {
  status: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  price_cents: number;
  customer_first_name: string;
  studio_name: string;
  studio_slug: string;
  studio_whatsapp: string | null;
  studio_address: string | null;
  timezone: string;
  primary_color: string;
  can_cancel: boolean;
  cancel_limit_hours: number;
};

async function cancel(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const supabase = createPublicClient();
  await supabase.rpc("cancel_public_appointment", { p_token: token });
  redirect(`/agendamento/${token}`);
}

export default async function AppointmentPage({ params, searchParams }: PageProps<"/agendamento/[token]">) {
  const { token } = await params;
  const { novo } = await searchParams;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_appointment", { p_token: token });
  const appt = data as PublicAppointment | null;
  if (!appt) notFound();

  const tz = appt.timezone;
  const color = appt.primary_color;
  const when = `${formatDateLong(appt.starts_at, tz)} às ${formatTime(appt.starts_at, tz)}`;
  const isNew = novo === "1";
  const message = `Olá! Sou ${appt.customer_first_name} e agendei ${appt.service_name} para ${when}.`;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <div className="card text-center">
        {isNew && appt.status !== "canceled" && (
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ backgroundColor: color }}
            aria-hidden
          >
            ✓
          </div>
        )}
        <h1 className="text-xl font-semibold">
          {appt.status === "canceled"
            ? "Agendamento cancelado"
            : appt.status === "pending"
              ? "Pedido de agendamento enviado!"
              : isNew
                ? "Agendamento confirmado!"
                : "Seu agendamento"}
        </h1>
        {appt.status === "pending" && (
          <p className="mt-1 text-sm text-stone-600">O studio vai confirmar o seu horário em breve.</p>
        )}

        <dl className="mt-5 space-y-2 rounded-xl bg-stone-50 p-4 text-left text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Studio</dt>
            <dd className="font-medium">{appt.studio_name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Serviço</dt>
            <dd className="font-medium">{appt.service_name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Quando</dt>
            <dd className="text-right font-medium capitalize">{when}</dd>
          </div>
          {appt.price_cents > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">Valor</dt>
              <dd className="font-medium">{formatMoney(appt.price_cents)}</dd>
            </div>
          )}
          {appt.studio_address && (
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">Endereço</dt>
              <dd className="text-right font-medium">{appt.studio_address}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Situação</dt>
            <dd>
              <StatusBadge status={appt.status} />
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          {appt.studio_whatsapp && (
            <a
              href={whatsappLink(appt.studio_whatsapp, message)}
              target="_blank"
              rel="noreferrer"
              className="btn py-3 text-white"
              style={{ backgroundColor: color }}
            >
              Falar com o studio no WhatsApp
            </a>
          )}
          {appt.can_cancel && (
            <form action={cancel}>
              <input type="hidden" name="token" value={token} />
              <ConfirmButton message="Tem certeza que deseja cancelar este agendamento?" className="btn-danger w-full">
                Cancelar agendamento
              </ConfirmButton>
            </form>
          )}
          {!appt.can_cancel && appt.status !== "canceled" && appt.cancel_limit_hours > 0 && (
            <p className="text-xs text-stone-500">
              Cancelamentos online até {appt.cancel_limit_hours}h antes. Depois disso, fale com o studio.
            </p>
          )}
          <Link href={`/s/${appt.studio_slug}`} className="btn-ghost">
            Fazer outro agendamento
          </Link>
        </div>
        {isNew && (
          <p className="mt-4 text-xs text-stone-500">
            Guarde este link: por ele você consulta ou cancela seu agendamento.
          </p>
        )}
      </div>
    </main>
  );
}
