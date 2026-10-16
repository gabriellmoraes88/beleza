"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "./guard";

// Toda operação sensível do administrador é registrada em audit_log.
async function audit(actorId: string, action: string, studioId: string, details: Record<string, unknown> = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, studio_id: studioId, details });
}

export async function suspendStudio(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || "Sem motivo informado";
  await createAdminClient()
    .from("studios")
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq("id", studioId);
  await audit(admin.id, "studio.suspend", studioId, { reason });
  revalidatePath("/admin");
}

export async function reactivateStudio(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  await createAdminClient().from("studios").update({ suspended_at: null, suspended_reason: null }).eq("id", studioId);
  await audit(admin.id, "studio.reactivate", studioId);
  revalidatePath("/admin");
}

export async function extendTrial(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const studioId = z.string().uuid().parse(formData.get("studio_id"));
  const days = z.coerce.number().int().min(1).max(60).parse(formData.get("days"));
  const db = createAdminClient();
  const { data: sub } = await db.from("subscriptions").select("trial_ends_at, status").eq("studio_id", studioId).single();
  const base = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date() ? new Date(sub.trial_ends_at) : new Date();
  const trialEnds = new Date(base.getTime() + days * 86_400_000).toISOString();
  await db
    .from("subscriptions")
    .update({ trial_ends_at: trialEnds, status: sub?.status === "expired" ? "trialing" : sub?.status })
    .eq("studio_id", studioId);
  await audit(admin.id, "subscription.extend_trial", studioId, { days, trial_ends_at: trialEnds });
  revalidatePath("/admin");
}
