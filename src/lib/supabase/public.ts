import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Cliente anônimo usado pela página pública de agendamento. Só consegue chamar
 * as funções públicas (get_public_studio, get_available_slots, book_appointment...).
 */
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
