import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Usuário logado que é administrador da plataforma (tabela platform_admins), ou null. */
export async function getPlatformAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  return isAdmin ? auth.user : null;
}

/** Só administradores da plataforma. Outros recebem 404. */
export async function requirePlatformAdmin() {
  const user = await getPlatformAdmin();
  if (!user) notFound();
  return user;
}
