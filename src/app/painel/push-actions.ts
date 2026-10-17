"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStudio, pushPublicKey } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export async function getPushKey(): Promise<string> {
  await requireStudio();
  return pushPublicKey();
}

/** Cadastra este aparelho para receber os avisos do studio. */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const { studio, user } = await requireStudio();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        studio_id: studio.id,
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: ua,
      },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { user } = await requireStudio();
  if (typeof endpoint !== "string") return;
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
}

export async function sendTestPush(): Promise<void> {
  const { studio } = await requireStudio();
  await notifyStudio(studio.id, {
    title: "Avisos ativados",
    body: "Você vai receber aqui os agendamentos novos, alterados e cancelados.",
    url: "/painel",
  });
}
