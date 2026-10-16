"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { friendlyError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { isValidDateStr, zonedToUtc } from "@/lib/time";
import type { ActionState, AppointmentStatus } from "@/lib/types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function refresh() {
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  revalidatePath("/painel/clientes", "layout");
}

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "canceled", "no_show"];

export async function setAppointmentStatus(formData: FormData) {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().parse(formData.get("id"));
  const status = z.enum(STATUSES as [AppointmentStatus, ...AppointmentStatus[]]).parse(formData.get("status"));
  await supabase
    .from("appointments")
    .update({
      status,
      canceled_at: status === "canceled" ? new Date().toISOString() : null,
      canceled_by: status === "canceled" ? "studio" : null,
    })
    .eq("id", id)
    .eq("studio_id", studio.id);
  refresh();
}

export async function rescheduleAppointment(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!id.success || !isValidDateStr(date) || !TIME.test(time)) return { error: "Informe data e horário." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", id.data)
    .eq("studio_id", studio.id)
    .single();
  if (!appt) return { error: "Agendamento não encontrado." };

  const duration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
  const startsAt = zonedToUtc(date, time, studio.timezone);
  const { error } = await supabase
    .from("appointments")
    .update({ starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + duration).toISOString() })
    .eq("id", id.data)
    .eq("studio_id", studio.id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Horário alterado." };
}

export async function saveInternalNote(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const note = String(formData.get("internal_note") ?? "").trim().slice(0, 1000);
  if (!id.success) return { error: "Agendamento inválido." };
  const { error } = await supabase
    .from("appointments")
    .update({ internal_note: note || null })
    .eq("id", id.data)
    .eq("studio_id", studio.id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Observação salva." };
}

export async function createManualAppointment(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const serviceId = z.string().uuid().safeParse(formData.get("service_id"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!serviceId.success) return { error: "Escolha o serviço." };
  if (!isValidDateStr(date) || !TIME.test(time)) return { error: "Informe data e horário." };
  if (name.length < 2) return { error: "Informe o nome da cliente." };
  if (!phone) return { error: "Informe um telefone válido com DDD." };

  const { error } = await supabase.rpc("create_manual_appointment", {
    p_studio_id: studio.id,
    p_service_id: serviceId.data,
    p_starts_at: zonedToUtc(date, time, studio.timezone).toISOString(),
    p_customer_name: name,
    p_customer_phone: phone,
    p_internal_note: String(formData.get("internal_note") ?? "") || null,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Agendamento criado." };
}
