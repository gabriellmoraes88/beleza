import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Entrar no painel</h1>
      <ActionForm action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/painel"} />
        <Field label="E-mail">
          <input className="input" type="email" name="email" autoComplete="email" required />
        </Field>
        <Field label="Senha">
          <input className="input" type="password" name="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton pendingText="Entrando…" className="btn-primary w-full">
          Entrar
        </SubmitButton>
      </ActionForm>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-stone-600 hover:underline">
          Esqueci a senha
        </Link>
        <Link href="/cadastro" className="font-medium text-brand-700 hover:underline">
          Criar conta
        </Link>
      </div>
    </>
  );
}
