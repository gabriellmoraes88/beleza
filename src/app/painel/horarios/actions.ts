"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { friendlyError } from "@/lib/errors";
import { addDays, isValidDateStr, zonedToUtc } from "@/lib/time";
import type { ActionState } from "@/lib/types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Profissional do formulário, conferindo que é deste studio. Sem valor: a primeira ativa. */
async function pickProfessional(formData: FormData) {
  const { supabase, studio, professional } = await requireStudio();
  const raw = String(formData.get("professional_id") ?? "");
  if (!raw) return professional;
  if (!z.string().uuid().safeParse(raw).success) return null;
  const { data } = await supabase
    .from("professionals")
    .select("id, name")
    .eq("id", raw)
    .eq("studio_id", studio.id)
    .maybeSingle();
  return data;
}

export async function saveWorkingHours(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireStudio();
  const professional = await pickProfessional(formData);
  if (!professional) return { error: "Nenhum profissional ativo encontrado." };

  const hours: { weekday: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (formData.get(`open_${d}`) !== "on") continue;
    for (const n of [1, 2]) {
      const start = String(formData.get(`start${n}_${d}`) ?? "");
      const end = String(formData.get(`end${n}_${d}`) ?? "");
      if (!start && !end) continue;
      if (!TIME.test(start) || !TIME.test(end)) return { error: "Preencha os horários no formato 09:00." };
      if (end <= start) return { error: "O horário final precisa ser depois do inicial." };
      hours.push({ weekday: d, start, end });
    }
  }

  const { error } = await supabase.rpc("set_working_hours", {
    p_professional_id: professional.id,
    p_hours: hours,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/painel/horarios");
  return { message: "Horários salvos." };
}

const blockSchema = z.object({
  start_date: z.string().refine(isValidDateStr, "Data inicial inválida."),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  reason: z.string().trim().max(120).optional(),
});

export async function createBlock(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio, user } = await requireStudio();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { start_date, reason } = parsed.data;
  const end_date = isValidDateStr(parsed.data.end_date) ? parsed.data.end_date : start_date;
  // Vazio = studio inteiro.
  const professionalId = formData.get("professional_id") ? (await pickProfessional(formData))?.id : null;
  if (professionalId === undefined) return { error: "Profissional inválida." };
  const allDay = formData.get("all_day") === "on";
  const tz = studio.timezone;

  let startsAt: Date;
  let endsAt: Date;
  if (allDay) {
    startsAt = zonedToUtc(start_date, "00:00", tz);
    endsAt = zonedToUtc(addDays(end_date, 1), "00:00", tz);
  } else {
    if (!TIME.test(parsed.data.start_time ?? "") || !TIME.test(parsed.data.end_time ?? "")) {
      return { error: "Informe o horário inicial e final, ou marque dia inteiro." };
    }
    startsAt = zonedToUtc(start_date, parsed.data.start_time!, tz);
    endsAt = zonedToUtc(end_date, parsed.data.end_time!, tz);
  }
  if (endsAt <= startsAt) return { error: "O fim do bloqueio precisa ser depois do início." };

  const { error } = await supabase.from("time_blocks").insert({
    studio_id: studio.id,
    professional_id: professionalId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: reason || null,
    created_by: user.id,
  });
  if (error) return { error: friendlyError(error) };

  // Avisa se já existem agendamentos no período bloqueado (eles não são cancelados automaticamente).
  let overlap = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studio.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());
  if (professionalId) overlap = overlap.eq("professional_id", professionalId);
  const { count } = await overlap;

  revalidatePath("/painel/horarios");
  revalidatePath("/painel/agenda");
  return {
    message: count
      ? `Bloqueio criado. Atenção: há ${count} agendamento(s) nesse período. Confira na agenda.`
      : "Bloqueio criado.",
  };
}

export async function deleteBlock(formData: FormData) {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().parse(formData.get("id"));
  await supabase.from("time_blocks").delete().eq("id", id).eq("studio_id", studio.id);
  revalidatePath("/painel/horarios");
  revalidatePath("/painel/agenda");
}
