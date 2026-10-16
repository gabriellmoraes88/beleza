import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Recuperar senha</h1>
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="E-mail da conta">
          <input className="input" type="email" name="email" autoComplete="email" required />
        </Field>
        <SubmitButton pendingText="Enviando…" className="btn-primary w-full">
          Enviar link
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/entrar" className="text-stone-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
