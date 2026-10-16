"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_BUCKET, detectImageType, photoUrl } from "@/lib/photos";
import type { ActionState } from "@/lib/types";

const CONTENT_TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

async function readImage(formData: FormData) {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma foto." } as const;
  if (file.size > MAX_PHOTO_BYTES) return { error: "A foto pode ter no máximo 5 MB." } as const;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { error: "Envie uma imagem JPG, PNG ou WEBP." } as const;
  return { bytes, type } as const;
}

/** Remove do Storage um arquivo nosso a partir da URL pública salva no banco. */
async function removeByUrl(url: string | null, studioId: string) {
  const prefix = photoUrl(`${studioId}/`);
  if (!url || !url.startsWith(prefix)) return;
  await createAdminClient().storage.from(PHOTO_BUCKET).remove([`${studioId}/${url.slice(prefix.length)}`]);
}

export async function uploadLogo(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };

  // Grava o novo endereço com o usuário logado (RLS confere studio e assinatura) e só então envia.
  const path = `${studio.id}/logo-${randomUUID()}.${image.type}`;
  const { error } = await supabase.from("studios").update({ logo_url: photoUrl(path) }).eq("id", studio.id);
  if (error) return { error: friendlyError(error) };

  const { error: uploadError } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .upload(path, image.bytes, { contentType: CONTENT_TYPE[image.type], cacheControl: "31536000", upsert: false });
  if (uploadError) {
    await supabase.from("studios").update({ logo_url: studio.logo_url }).eq("id", studio.id);
    return { error: "Não foi possível enviar a imagem. Tente novamente." };
  }

  await removeByUrl(studio.logo_url, studio.id);
  revalidatePath("/painel", "layout");
  revalidatePath(`/s/${studio.slug}`);
  return { message: "Logotipo atualizado." };
}

export async function removeLogo() {
  const { supabase, studio } = await requireStudio();
  const { error } = await supabase.from("studios").update({ logo_url: null }).eq("id", studio.id);
  if (!error) await removeByUrl(studio.logo_url, studio.id);
  revalidatePath("/painel", "layout");
  revalidatePath(`/s/${studio.slug}`);
}

export async function uploadPhoto(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, studio } = await requireStudio();
  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };
  const { bytes, type } = image;

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
