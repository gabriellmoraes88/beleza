"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { slugify } from "@/lib/slug";
import { createStudio } from "./actions";

export function CreateStudioForm({ siteUrl }: { siteUrl: string }) {
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  return (
    <ActionForm action={createStudio} className="card space-y-4">
      <Field label="Nome do studio">
        <input
          className="input"
          name="name"
          placeholder="Espaço da Ana"
          required
          maxLength={80}
          onChange={(e) => !touched && setSlug(slugify(e.target.value))}
        />
      </Field>
      <Field label="Seu nome">
        <input className="input" name="owner_name" autoComplete="name" required maxLength={80} />
      </Field>
      <Field label="WhatsApp do studio" hint="Suas clientes poderão chamar você por ele.">
        <input className="input" name="phone" type="tel" inputMode="tel" placeholder="(11) 99999-0000" required />
      </Field>
      <Field label="Endereço do seu link" hint={`${siteUrl}/s/${slug || "seu-studio"}`}>
        <input
          className="input"
          name="slug"
          value={slug}
          onChange={(e) => {
            setTouched(true);
            setSlug(slugify(e.target.value));
          }}
          required
          minLength={3}
          maxLength={40}
        />
      </Field>
      <SubmitButton pendingText="Criando…" className="btn-primary w-full">
        Criar meu studio
      </SubmitButton>
    </ActionForm>
  );
}
