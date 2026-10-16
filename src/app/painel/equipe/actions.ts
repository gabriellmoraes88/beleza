"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const name = z.string().trim().min(1, "Informe o nome.").max(80, "Nome muito longo.");

function refresh() {
  revalidatePath("/painel", "layout");
}

async function requireOwner() {
  const ctx = await requireStudio();
  if (ctx.role !== "owner") throw new Error("Somente a proprietária gerencia a equipe.");
  return ctx;
}

export async function addProfessional(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio, role } = await requireStudio();
  if (role !== "owner") return { error: "Somente a proprietária gerencia a equipe." };
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.rpc("add_professional", { p_studio_id: studio.id, p_name: parsed.data });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: `${parsed.data} entrou na equipe com o mesmo horário da primeira profissional. Ajuste em Horários.` };
}

export async function renameProfessional(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio, role } = await requireStudio();
  if (role !== "owner") return { error: "Somente a proprietária gerencia a equipe." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = name.safeParse(formData.get("name"));
  if (!id.success) return { error: "Profissional inválida." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase
    .from("professionals")
    .update({ name: parsed.data })
    .eq("id", id.data)
    .eq("studio_id", studio.id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Nome salvo." };
}

export async function setProfessionalActive(formData: FormData) {
  const { supabase, studio } = await requireOwner();
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!active) {
    // Sempre sobra pelo menos uma profissional ativa.
    const { count } = await supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio.id)
      .eq("active", true)
      .neq("id", id);
    if (!count) return;
  }
  await supabase.from("professionals").update({ active }).eq("id", id).eq("studio_id", studio.id);
  refresh();
}

export async function setProfessionalServices(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, role } = await requireStudio();
  if (role !== "owner") return { error: "Somente a proprietária gerencia a equipe." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  const services = z.array(z.string().uuid()).safeParse(formData.getAll("service_id"));
  if (!id.success || !services.success) return { error: "Dados inválidos." };
  if (services.data.length === 0) return { error: "Marque pelo menos um serviço." };
  // A função confere que a profissional e os serviços são deste studio.
  const { error } = await supabase.rpc("set_professional_services", {
    p_professional_id: id.data,
    p_service_ids: services.data,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Serviços salvos." };
}
