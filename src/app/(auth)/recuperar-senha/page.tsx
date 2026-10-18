import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { requestPasswordReset, resetPasswordWithDocument } from "../actions";

export const metadata: Metadata = { title: "Recuperar senha" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const byLink = (await searchParams).link === "1";

  return (
    <>
      <h1 className="text-lg font-semibold">Recuperar senha</h1>
      {byLink ? (
        <>
          <p className="mb-4 mt-1 text-sm text-stone-600">Enviaremos um link para você criar uma nova senha.</p>
          <ActionForm action={requestPasswordReset} className="space-y-4">
            <Field label="E-mail da conta">
              <input className="input" type="email" name="email" autoComplete="email" required />
            </Field>
            <SubmitButton pendingText="Enviando…" className="btn-primary w-full">
              Enviar link
            </SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm">
            <Link href="/recuperar-senha" className="text-stone-600 hover:underline">
              Recuperar com CPF/CNPJ
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mb-4 mt-1 text-sm text-stone-600">Confirme o e-mail e o CPF/CNPJ da conta e escolha a nova senha.</p>
          <ActionForm action={resetPasswordWithDocument} className="space-y-4">
            <Field label="E-mail da conta">
              <input className="input" type="email" name="email" autoComplete="email" required />
            </Field>
            <Field label="CPF ou CNPJ">
              <input className="input" name="cpf_cnpj" inputMode="numeric" autoComplete="off" maxLength={18} required />
            </Field>
            <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
              <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Repita a nova senha">
              <input className="input" type="password" name="password_confirm" autoComplete="new-password" minLength={8} required />
            </Field>
            <SubmitButton pendingText="Trocando…" className="btn-primary w-full">
              Trocar senha
            </SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm">
            <Link href="/recuperar-senha?link=1" className="text-stone-600 hover:underline">
              Não cadastrou CPF/CNPJ? Receber link por e-mail
            </Link>
          </p>
        </>
      )}
      <p className="mt-2 text-center text-sm">
        <Link href="/entrar" className="text-stone-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
