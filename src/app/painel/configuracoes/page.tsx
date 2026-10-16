import type { Metadata } from "next";
import { requireStudio } from "@/lib/studio";
import { SITE_URL } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { updateStudio } from "./actions";

export const metadata: Metadata = { title: "Configurações do studio" };

export default async function SettingsPage() {
  const { studio } = await requireStudio();
  const url = `${SITE_URL()}/s/${studio.slug}`;

  return (
    <>
      <PageHeader title="Studio" description="Dados exibidos na sua página de agendamento e regras de reserva." />
      <div className="mb-5 card">
        <h2 className="mb-3 font-semibold">Seu link de agendamento</h2>
        <ShareLink url={url} studioName={studio.name} />
      </div>

      <ActionForm action={updateStudio} className="space-y-5">
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Informações públicas</h2>
          <Field label="Nome do studio">
            <input className="input" name="name" defaultValue={studio.name} required />
          </Field>
          <Field label="Responsável">
            <input className="input" name="owner_name" defaultValue={studio.owner_name ?? ""} />
          </Field>
          <Field label="WhatsApp">
            <input className="input" name="whatsapp" type="tel" defaultValue={formatPhone(studio.whatsapp)} />
          </Field>
          <Field label="Instagram">
            <input className="input" name="instagram" defaultValue={studio.instagram ?? ""} placeholder="@seustudio" />
          </Field>
          <Field label="Endereço">
            <input className="input" name="address" defaultValue={studio.address ?? ""} placeholder="Rua das Flores, 123" />
          </Field>
          <Field label="Cidade">
            <input className="input" name="city" defaultValue={studio.city ?? ""} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="show_address" defaultChecked={studio.show_address} className="h-4 w-4" />
            Mostrar endereço na página pública
          </label>
          <div className="sm:col-span-2">
            <Field label="Descrição curta">
              <textarea className="input" name="description" rows={2} maxLength={500} defaultValue={studio.description ?? ""} />
            </Field>
          </div>
          <Field label="Link do logotipo (opcional)" hint="Upload de imagem chega numa próxima versão.">
            <input className="input" name="logo_url" type="url" defaultValue={studio.logo_url ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Cor principal">
            <input className="h-11 w-full rounded-xl border border-stone-300" type="color" name="primary_color" defaultValue={studio.primary_color} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Endereço do link" hint={`${SITE_URL()}/s/…  Ao mudar, o link antigo deixa de funcionar.`}>
              <input className="input" name="slug" defaultValue={studio.slug} required minLength={3} maxLength={40} />
            </Field>
          </div>
        </section>

        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Regras de agendamento</h2>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="auto_confirm" defaultChecked={studio.auto_confirm} className="mt-0.5 h-4 w-4" />
            <span>
              Confirmar agendamentos automaticamente
              <span className="block text-stone-500">Desmarque para aprovar cada pedido manualmente na agenda.</span>
            </span>
          </label>
          <Field label="Intervalo entre horários oferecidos">
            <select className="input" name="slot_interval_minutes" defaultValue={studio.slot_interval_minutes}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  A cada {m} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Antecedência mínima">
            <select className="input" name="min_advance_minutes" defaultValue={studio.min_advance_minutes}>
              {[
                [0, "Sem antecedência"],
                [30, "30 minutos"],
                [60, "1 hora"],
                [120, "2 horas"],
                [240, "4 horas"],
                [720, "12 horas"],
                [1440, "1 dia"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agendar até quantos dias à frente">
            <input className="input" type="number" name="max_advance_days" min={1} max={365} defaultValue={studio.max_advance_days} />
          </Field>
          <Field label="Cliente pode cancelar online até (horas antes)">
            <input className="input" type="number" name="cancel_limit_hours" min={0} max={168} defaultValue={studio.cancel_limit_hours} />
          </Field>
        </section>

        <SubmitButton>Salvar configurações</SubmitButton>
      </ActionForm>
    </>
  );
}
