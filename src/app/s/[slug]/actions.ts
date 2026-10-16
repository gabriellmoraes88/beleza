"use server";

import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { normalizePhone } from "@/lib/phone";
import { friendlyError } from "@/lib/errors";
import { isValidDateStr } from "@/lib/time";

const serviceIdsSchema = z.array(z.string().uuid()).min(1).max(5);

const professionalSchema = z.string().uuid().nullable();

/** professionalId nulo = qualquer profissional. */
export async function fetchSlots(
  slug: string,
  serviceIds: string[],
  date: string,
  professionalId: string | null = null,
): Promise<string[]> {
  if (
    !isValidDateStr(date) ||
    !serviceIdsSchema.safeParse(serviceIds).success ||
    !professionalSchema.safeParse(professionalId).success
  ) {
    return [];
  }
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_available_slots_multi", {
    p_slug: slug,
    p_service_ids: serviceIds,
    p_date: date,
    p_professional_id: professionalId,
  });
  if (error || !data) return [];
  return (data as string[]).map((s) => new Date(s).toISOString());
}

const bookingSchema = z.object({
  slug: z.string().min(3).max(40),
  serviceIds: serviceIdsSchema,
  professionalId: professionalSchema.optional(),
  startsAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  phone: z.string().trim().min(8, "Informe seu telefone com DDD."),
  note: z.string().trim().max(500, "A observação está muito longa.").optional(),
});

export type BookingResult = { ok: true; token: string } | { ok: false; error: string; slotTaken?: boolean };

export async function bookAppointment(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "Informe um telefone válido com DDD." };

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("book_appointment_multi", {
      p_slug: parsed.data.slug,
      p_service_ids: parsed.data.serviceIds,
      p_starts_at: parsed.data.startsAt,
      p_customer_name: parsed.data.name,
      p_customer_phone: phone,
      p_customer_note: parsed.data.note || null,
      p_professional_id: parsed.data.professionalId ?? null,
    })
    .single<{ token: string; status: string }>();

  if (error || !data) {
    return { ok: false, error: friendlyError(error), slotTaken: error?.message === "SLOT_UNAVAILABLE" };
  }
  return { ok: true, token: data.token };
}
