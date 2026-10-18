"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import type { ActionState } from "@/lib/types";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/painel";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    }
    return { error: "E-mail ou senha incorretos." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${SITE_URL()}/auth/confirm?next=/painel/configurar` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Já existe uma conta com esse e-mail." };
    if (error.code === "weak_password") return { error: "Escolha uma senha mais forte." };
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }
  if (!data.session) {
    return { message: "Conta criada! Enviamos um link de confirmação para o seu e-mail." };
  }
  redirect("/painel/configurar");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE_URL()}/auth/confirm?next=/painel/nova-senha`,
  });
  return { ok: true, message: "Se o e-mail estiver cadastrado, você vai receber um código de 6 números." };
}

const resetWithCode = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  code: z.string().trim().regex(/^\d{6,10}$/, "Digite o código de 6 números que chegou no e-mail."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

/** Confirma o código enviado por e-mail e já salva a nova senha, sem precisar abrir link. */
export async function resetPasswordWithCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetWithCode.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "recovery",
  });
  if (error) return { error: "Código inválido ou vencido. Peça um novo código." };

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updateError) {
    if (updateError.code === "same_password") return { error: "Escolha uma senha diferente da anterior." };
    return { error: "Não foi possível salvar a nova senha. Tente novamente." };
  }
  redirect("/painel");
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Não foi possível alterar a senha. Peça um novo link." };
  return { message: "Senha alterada com sucesso." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
