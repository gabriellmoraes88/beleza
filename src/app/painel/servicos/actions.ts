"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { parseMoneyToCents } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(80),
  description: z.string().trim().max(300).optional(),
  duration_minutes: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(600),
  price: z.string().optional(),
});

export async function saveService(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const price = parseMoneyToCents(parsed.data.price ?? "");
  if (price === null) return { error: "Preço inválido." };

  const row = {
    studio_id: studio.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    duration_minutes: parsed.data.duration_minutes,
    price_cents: price,
    active: formData.get("active") === "on",
    is_public: formData.get("is_public") === "on",
  };

  const { error } = parsed.data.id
    ? await supabase.from("services").update(row).eq("id", parsed.data.id).eq("studio_id", studio.id)
    : await supabase.from("services").insert(row);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/painel/servicos");
  return { message: parsed.data.id ? "Serviço atualizado." : "Serviço cadastrado." };
}

export async function deleteService(formData: FormData) {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().parse(formData.get("id"));
  await supabase.from("services").delete().eq("id", id).eq("studio_id", studio.id);
  revalidatePath("/painel/servicos");
}
