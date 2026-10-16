"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { normalizePhone } from "@/lib/phone";
import { validateSlug } from "@/lib/slug";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const optional = (max: number) => z.string().trim().max(max).optional();

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do studio.").max(80),
  owner_name: optional(80),
  whatsapp: z.string().trim().optional(),
  address: optional(200),
  city: optional(80),
  description: optional(500),
  instagram: optional(60),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  slug: z.string().trim().toLowerCase(),
  slot_interval_minutes: z.coerce.number().int().min(5).max(120),
  min_advance_minutes: z.coerce.number().int().min(0).max(10080),
  max_advance_days: z.coerce.number().int().min(1).max(365),
  cancel_limit_hours: z.coerce.number().int().min(0).max(168),
});

export async function updateStudio(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const slugError = validateSlug(d.slug);
  if (slugError) return { error: slugError };

  let whatsapp: string | null = null;
  if (d.whatsapp) {
    whatsapp = normalizePhone(d.whatsapp);
    if (!whatsapp) return { error: "WhatsApp inválido." };
  }

  const { error } = await supabase
    .from("studios")
    .update({
      name: d.name,
      owner_name: d.owner_name || null,
      whatsapp,
      address: d.address || null,
      city: d.city || null,
      description: d.description || null,
      instagram: d.instagram?.replace(/^@/, "") || null,
      primary_color: d.primary_color,
      slug: d.slug,
      show_address: formData.get("show_address") === "on",
      auto_confirm: formData.get("auto_confirm") === "on",
      slot_interval_minutes: d.slot_interval_minutes,
      min_advance_minutes: d.min_advance_minutes,
      max_advance_days: d.max_advance_days,
      cancel_limit_hours: d.cancel_limit_hours,
      onboarding_completed_at: studio.onboarding_completed_at ?? new Date().toISOString(),
    })
    .eq("id", studio.id);

  if (error) {
    if (error.code === "23505") return { error: "Esse endereço já está em uso. Tente outro." };
    return { error: friendlyError(error) };
  }
  revalidatePath("/painel", "layout");
  return { message: "Configurações salvas." };
}
