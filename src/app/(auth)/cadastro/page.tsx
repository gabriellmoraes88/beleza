import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Crie sua conta</h1>
      <p className="mb-4 mt-1 text-sm text-stone-600">14 dias grátis, sem cartão de crédito.</p>
      <ActionForm action={signUp} className="space-y-4">
        <Field label="E-mail">
          <input className="input" type="email" name="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton pendingText="Criando…" className="btn-primary w-full">
          Criar conta grátis
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-stone-600">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
