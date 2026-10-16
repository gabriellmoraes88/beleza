"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  notes: z.string().trim().max(1000).optional(),
});

export async function updateCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase
    .from("customers")
    .update({ name: parsed.data.name, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id)
    .eq("studio_id", studio.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/painel/clientes/${parsed.data.id}`);
  return { message: "Dados salvos." };
}
