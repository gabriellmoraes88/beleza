import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Cliente com a chave secreta (ignora RLS). Use SOMENTE no servidor, para
 * webhooks, cobrança e o painel da plataforma, sempre após checar permissões.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY");
  return createClient(SUPABASE_URL(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
