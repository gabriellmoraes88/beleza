"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { validateSlug } from "@/lib/slug";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do studio.").max(80),
  owner_name: z.string().trim().min(2, "Informe o nome da responsável.").max(80),
  phone: z.string().trim(),
  slug: z.string().trim().toLowerCase(),
});

export async function createStudio(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Informe um telefone válido com DDD." };
  const slugError = validateSlug(parsed.data.slug);
  if (slugError) return { error: slugError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_studio", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_owner_name: parsed.data.owner_name,
    p_phone: phone,
  });
  if (error) {
    if (error.message === "ALREADY_HAS_STUDIO") redirect("/painel");
    return { error: friendlyError(error) };
  }
  redirect("/painel/servicos?primeiro=1");
}
