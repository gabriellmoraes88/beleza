"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { Alert } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  className = "btn-primary",
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Formulário com server action que devolve { error | message } e mostra o resultado. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <div className="mt-3">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      {state?.message && (
        <div className="mt-3">
          <Alert tone="success">{state.message}</Alert>
        </div>
      )}
    </form>
  );
}

export function ConfirmButton({
  children,
  message,
  className = "btn-danger",
}: {
  children: ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
