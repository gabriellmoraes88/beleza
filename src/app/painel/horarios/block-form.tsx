import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { createBlock } from "./actions";

export function BlockForm({
  defaultDate,
  team,
  defaultProfessional,
}: {
  defaultDate: string;
  team: { id: string; name: string }[];
  defaultProfessional?: string;
}) {
  return (
    <ActionForm action={createBlock} className="space-y-3">
      {team.length > 0 && (
        <Field label="Para quem">
          <select className="input" name="professional_id" defaultValue={defaultProfessional ?? ""}>
            <option value="">Studio inteiro (todas)</option>
            {team.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="De">
          <input className="input" type="date" name="start_date" defaultValue={defaultDate} required />
        </Field>
        <Field label="Até">
          <input className="input" type="date" name="end_date" defaultValue={defaultDate} />
        </Field>
        <Field label="Hora inicial">
          <input className="input" type="time" name="start_time" defaultValue="12:00" />
        </Field>
        <Field label="Hora final">
          <input className="input" type="time" name="end_time" defaultValue="13:00" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="all_day" className="h-4 w-4" />
        Dia inteiro (folga, férias, feriado)
      </label>
      <Field label="Motivo (opcional, só você vê)">
        <input className="input" name="reason" maxLength={120} placeholder="Almoço, médico, férias…" />
      </Field>
      <SubmitButton>Bloquear horário</SubmitButton>
    </ActionForm>
  );
}
