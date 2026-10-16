import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markEvent, processWebhookEvent } from "@/lib/billing";

function validToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook do Asaas.
 * 1. Valida o token enviado no header `asaas-access-token`.
 * 2. Persiste o evento pelo `id` (entrega "pelo menos uma vez" => idempotência).
 * 3. Processa; se falhar, responde 200 mesmo assim (o evento já está salvo) e a
 *    rotina de conciliação tenta de novo, evitando pausar a fila no Asaas.
 */
export async function POST(request: NextRequest) {
  if (!validToken(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { id?: string; event?: string; [k: string]: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof payload.id !== "string" || typeof payload.event !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("asaas_webhook_events")
    .upsert({ id: payload.id, event: payload.event, payload }, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) {
    // Não conseguimos persistir: pede reenvio ao Asaas.
    console.error("asaas webhook: falha ao salvar evento", insertError);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }

  const { data: stored } = await admin
    .from("asaas_webhook_events")
    .select("processed_at, attempts")
    .eq("id", payload.id)
    .single();
  if (stored?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processWebhookEvent(admin, payload as Parameters<typeof processWebhookEvent>[1]);
    await markEvent(admin, payload.id, stored?.attempts ?? 0);
  } catch (error) {
    console.error("asaas webhook: falha ao processar", payload.id, error);
    await markEvent(admin, payload.id, stored?.attempts ?? 0, error);
  }
  return NextResponse.json({ received: true });
}
