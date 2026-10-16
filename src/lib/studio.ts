import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Studio, Subscription } from "@/lib/types";

/**
 * Usuário logado a partir do token da sessão. getClaims confere a assinatura do
 * token localmente (chaves públicas em cache), sem ida ao servidor de login a
 * cada clique; o proxy já renovou a sessão nesta requisição.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export const getStudioContext = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("studio_members")
    .select("studio_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) return { user, supabase, studio: null } as const;

  const [{ data: studio }, { data: subscription }, { data: hasAccess }, { data: professional }] =
    await Promise.all([
      supabase.from("studios").select("*").eq("id", membership.studio_id).single(),
      supabase.from("subscriptions").select("*").eq("studio_id", membership.studio_id).maybeSingle(),
      supabase.rpc("studio_has_access", { p_studio_id: membership.studio_id }),
      supabase
        .from("professionals")
        .select("id, name")
        .eq("studio_id", membership.studio_id)
        .eq("active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    user,
    supabase,
    role: membership.role as "owner" | "staff",
    studio: studio as Studio,
    subscription: subscription as Subscription | null,
    hasAccess: Boolean(hasAccess),
    professional: professional as { id: string; name: string } | null,
  } as const;
});

/** Para páginas do painel: exige studio criado. */
export async function requireStudio() {
  const ctx = await getStudioContext();
  if (!ctx.studio) redirect("/painel/configurar");
  return ctx;
}
