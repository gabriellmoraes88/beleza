"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccountByDocument, saveAccountDocument } from "@/lib/account-doc";
import { normalizeCpfCnpj } from "@/lib/cpf-cnpj";
import { getUser } from "@/lib/studio";
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
  const doc = normalizeCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  if (!doc) return { error: "Informe um CPF ou CNPJ válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${SITE_URL()}/auth/confirm?next=/painel/configurar` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Já existe uma conta com esse e-mail." };
    if (error.code === "weak_password") return { error: "Escolha uma senha mais forte." };
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }
  if (data.user) await saveAccountDocument(data.user.id, doc);
  if (!data.session) {
    return { message: "Conta criada! Enviamos um link de confirmação para o seu e-mail." };
  }
  // Lido uma vez no painel para contar o cadastro no Pixel da Meta (src/app/meta-pixel.tsx).
  (await cookies()).set("bl_signup", "1", { maxAge: 600, path: "/", sameSite: "lax" });
  redirect("/painel/configurar");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE_URL()}/auth/confirm?next=/painel/nova-senha`,
  });
  return { message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Não foi possível alterar a senha. Peça um novo link." };
  return { message: "Senha alterada com sucesso." };
}

const MAX_RESET_FAILS_PER_EMAIL = 5;
const MAX_RESET_FAILS_PER_IP = 20;

/** Troca a senha conferindo e-mail + CPF/CNPJ da conta (sem e-mail de recuperação). */
export async function resetPasswordWithDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (formData.get("password") !== formData.get("password_confirm")) {
    return { error: "As duas senhas não são iguais." };
  }
  const doc = normalizeCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  if (!doc) return { error: "Informe um CPF ou CNPJ válido." };
  const { email, password } = parsed.data;

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "?";
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const failures = (key: "email" | "ip", value: string) =>
    admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "auth.reset_failed")
      .eq(`details->>${key}`, value)
      .gte("created_at", since);
  const [{ count: byEmail }, { count: byIp }] = await Promise.all([failures("email", email), failures("ip", ip)]);
  if ((byEmail ?? 0) >= MAX_RESET_FAILS_PER_EMAIL || (byIp ?? 0) >= MAX_RESET_FAILS_PER_IP) {
    return { error: "Muitas tentativas. Aguarde uma hora e tente de novo." };
  }

  const userId = await findAccountByDocument(email, doc);
  if (!userId) {
    await admin.from("audit_log").insert({ action: "auth.reset_failed", details: { email, ip } });
    return { error: "E-mail ou CPF/CNPJ não conferem." };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    if (error.code === "weak_password") return { error: "Escolha uma senha mais forte." };
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }
  await admin.from("audit_log").insert({ actor_id: userId, action: "auth.password_reset", details: { ip } });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { message: "Senha alterada! Agora é só entrar com a nova senha." };
  redirect("/painel");
}

/** Cadastra ou troca o CPF/CNPJ usado para recuperar a senha. Pede a senha atual. */
export async function saveRecoveryDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user?.email) redirect("/entrar");
  const doc = normalizeCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  if (!doc) return { error: "Informe um CPF ou CNPJ válido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: String(formData.get("current_password") ?? ""),
  });
  if (error) return { error: "Senha atual incorreta." };

  if (!(await saveAccountDocument(user.id, doc))) return { error: "Não foi possível salvar. Tente novamente." };
  await createAdminClient().from("audit_log").insert({ actor_id: user.id, action: "auth.recovery_doc_set" });
  return { message: "CPF/CNPJ salvo. Você pode usá-lo para recuperar a senha." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
