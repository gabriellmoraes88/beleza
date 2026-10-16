import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Só administradores da plataforma (tabela platform_admins). Outros recebem 404. */
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  return auth.user;
}
