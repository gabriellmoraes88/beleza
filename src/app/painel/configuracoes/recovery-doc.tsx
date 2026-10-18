import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { saveRecoveryDocument } from "@/app/(auth)/actions";

/** CPF/CNPJ usado para recuperar a senha sem e-mail. */
export function RecoveryDocCard({ saved }: { saved: boolean }) {
  return (
    <section className="mb-5 card">
      <h2 className="font-semibold">CPF/CNPJ para recuperar a senha</h2>
      <p className="mt-1 text-sm text-stone-600">
        {saved
          ? "Já cadastrado. Se esquecer a senha, use seu e-mail e este CPF/CNPJ em “Esqueci a senha”. Pode trocar abaixo."
          : "Ainda não cadastrado. Cadastre para conseguir trocar a senha se esquecer."}
      </p>
      <ActionForm action={saveRecoveryDocument} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={saved ? "Novo CPF ou CNPJ" : "CPF ou CNPJ"}>
          <input className="input" name="cpf_cnpj" inputMode="numeric" autoComplete="off" maxLength={18} required />
        </Field>
        <Field label="Sua senha atual">
          <input className="input" type="password" name="current_password" autoComplete="current-password" required />
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton>Salvar CPF/CNPJ</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
