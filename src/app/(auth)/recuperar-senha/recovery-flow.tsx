"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form";
import { Alert, Field } from "@/components/ui";
import { requestPasswordReset, resetPasswordWithCode } from "../actions";

/** Passo 1: e-mail. Passo 2: código recebido + nova senha, na mesma tela. */
export function RecoveryFlow() {
  const [email, setEmail] = useState("");
  const [sent, sendAction] = useActionState(requestPasswordReset, undefined);
  const [reset, resetAction] = useActionState(resetPasswordWithCode, undefined);

  if (!sent?.ok) {
    return (
      <form action={sendAction} className="space-y-4">
        <Field label="E-mail da conta">
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <SubmitButton pendingText="Enviando…" className="btn-primary w-full">
          Enviar código
        </SubmitButton>
        {sent?.error && <Alert tone="error">{sent.error}</Alert>}
      </form>
    );
  }

  return (
    <form action={resetAction} className="space-y-4">
      <Alert tone="success">{sent.message}</Alert>
      <input type="hidden" name="email" value={email} />
      <Field label="Código do e-mail">
        <input
          className="input tracking-[0.3em]"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          required
        />
      </Field>
      <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
        <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton pendingText="Salvando…" className="btn-primary w-full">
        Salvar nova senha
      </SubmitButton>
      {reset?.error && <Alert tone="error">{reset.error}</Alert>}
      <p className="text-center text-sm">
        <a href="/recuperar-senha" className="text-stone-600 hover:underline">
          Pedir outro código
        </a>
      </p>
    </form>
  );
}
