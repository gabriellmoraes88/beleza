"use server";

import { after } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { friendlyError } from "@/lib/errors";
import { isValidDateStr } from "@/lib/time";
import { notifyAppointment } from "@/lib/push";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

/** Horários livres para mudar o agendamento, com a mesma profissional e duração. */
export async function fetchRescheduleSlots(token: string, date: string): Promise<string[]> {
  if (!tokenSchema.safeParse(token).success || !isValidDateStr(date)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_reschedule_slots", { p_token: token, p_date: date });
  if (error || !data) return [];
  return (data as string[]).map((s) => new Date(s).toISOString());
}

export type RescheduleResult = { ok: true } | { ok: false; error: string; slotTaken?: boolean };

export async function reschedule(token: string, startsAt: string): Promise<RescheduleResult> {
  if (!tokenSchema.safeParse(token).success || !z.string().datetime({ offset: true }).safeParse(startsAt).success) {
    return { ok: false, error: "Escolha um horário." };
  }
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("reschedule_public_appointment", { p_token: token, p_starts_at: startsAt });
  if (error) return { ok: false, error: friendlyError(error), slotTaken: error.message === "SLOT_UNAVAILABLE" };
  after(() => notifyAppointment(token, "alterado"));
  return { ok: true };
}
