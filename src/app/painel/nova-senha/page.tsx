import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { updatePassword } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Nova senha" };

export default function NewPasswordPage() {
  return (
    <div className="max-w-md">
      <PageHeader title="Criar nova senha" />
      <ActionForm action={updatePassword} className="card space-y-4">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton>Salvar senha</SubmitButton>
      </ActionForm>
    </div>
  );
}
