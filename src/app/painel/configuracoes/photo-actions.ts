"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_BUCKET, detectImageType } from "@/lib/photos";
import type { ActionState } from "@/lib/types";

const CONTENT_TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function uploadPhoto(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma foto." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "A foto pode ter no máximo 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { error: "Envie uma imagem JPG, PNG ou WEBP." };

  const { count } = await supabase
    .from("studio_photos")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studio.id);
  if ((count ?? 0) >= MAX_PHOTOS) return { error: `Você pode ter até ${MAX_PHOTOS} fotos.` };

  // Primeiro grava o registro com o usuário logado (o RLS confere se o studio é dele
  // e se a assinatura permite alterações); só depois envia o arquivo.
  const path = `${studio.id}/${randomUUID()}.${type}`;
  const { data: row, error } = await supabase
    .from("studio_photos")
    .insert({ studio_id: studio.id, path, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error || !row) return { error: friendlyError(error) };

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: CONTENT_TYPE[type], cacheControl: "31536000", upsert: false });
  if (uploadError) {
    await supabase.from("studio_photos").delete().eq("id", row.id);
    return { error: "Não foi possível enviar a foto. Tente novamente." };
  }

  revalidatePath("/painel/configuracoes");
  revalidatePath(`/s/${studio.slug}`);
  return { message: "Foto adicionada." };
}

export async function deletePhoto(formData: FormData) {
  const { supabase, studio } = await requireStudio();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const { data } = await supabase.from("studio_photos").delete().eq("id", id.data).select("path").maybeSingle();
  if (data?.path) {
    await createAdminClient().storage.from(PHOTO_BUCKET).remove([data.path]);
  }
  revalidatePath("/painel/configuracoes");
  revalidatePath(`/s/${studio.slug}`);
}
