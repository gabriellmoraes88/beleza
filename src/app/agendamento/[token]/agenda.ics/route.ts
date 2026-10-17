import type { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

type AppointmentForCalendar = {
  status: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  professional_name?: string | null;
  studio_name: string;
  studio_address: string | null;
};

// Data no formato do calendário: 20261018T170000Z
function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Escapa texto conforme o padrão iCalendar.
function icsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Arquivo de calendário do agendamento, com lembretes 1 dia e 2 horas antes. */
export async function GET(request: NextRequest, ctx: RouteContext<"/agendamento/[token]/agenda.ics">) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Não encontrado", { status: 404 });

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_appointment", { p_token: token });
  const appt = data as AppointmentForCalendar | null;
  if (!appt || appt.status === "canceled") return new Response("Não encontrado", { status: 404 });

  const link = new URL(`/agendamento/${token}`, request.nextUrl.origin).toString();
  const title = `${appt.service_name} · ${appt.studio_name}`;
  const details = [
    appt.professional_name ? `Com ${appt.professional_name}` : null,
    `Para alterar ou cancelar: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bellink//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Mesmo UID para o mesmo agendamento: salvar de novo depois de alterar o horário atualiza o evento.
    `UID:${token.slice(0, 32)}@bellink`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(appt.starts_at)}`,
    `DTEND:${icsDate(appt.ends_at)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(details)}`,
    appt.studio_address ? `LOCATION:${icsText(appt.studio_address)}` : null,
    `URL:${link}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`Amanhã: ${title}`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`Daqui a 2 horas: ${title}`)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agendamento.ics"',
      "Cache-Control": "no-store",
    },
  });
}
