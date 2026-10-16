import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { createManualAppointment } from "./actions";

export function NewAppointmentForm({
  services,
  defaultDate,
}: {
  services: { id: string; name: string; duration_minutes: number }[];
  defaultDate: string;
}) {
  if (services.length === 0) {
    return <p className="text-sm text-stone-600">Cadastre um serviço antes de criar agendamentos.</p>;
  }
  return (
    <ActionForm action={createManualAppointment} className="space-y-3">
      <Field label="Serviço">
        <select className="input" name="service_id" required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({formatDuration(s.duration_minutes)})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input className="input" type="date" name="date" defaultValue={defaultDate} required />
        </Field>
        <Field label="Horário">
          <input className="input" type="time" name="time" required />
        </Field>
      </div>
      <Field label="Nome da cliente">
        <input className="input" name="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Telefone" hint="Se a cliente já existe, o histórico é unificado pelo telefone.">
        <input className="input" name="phone" type="tel" inputMode="tel" placeholder="(11) 99999-0000" required />
      </Field>
      <Field label="Observação interna (opcional)">
        <input className="input" name="internal_note" maxLength={1000} />
      </Field>
      <SubmitButton>Criar agendamento</SubmitButton>
    </ActionForm>
  );
}
