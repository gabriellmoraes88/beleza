import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { Service } from "@/lib/types";
import { saveService } from "./actions";

export function ServiceForm({ service }: { service?: Service }) {
  return (
    <ActionForm action={saveService} className="space-y-3">
      {service && <input type="hidden" name="id" value={service.id} />}
      <Field label="Nome">
        <input className="input" name="name" defaultValue={service?.name} placeholder="Manicure tradicional" required />
      </Field>
      <Field label="Descrição (opcional)">
        <input
          className="input"
          name="description"
          defaultValue={service?.description ?? ""}
          placeholder="Esmaltação e cuidados básicos"
          maxLength={300}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duração (min)">
          <input
            className="input"
            name="duration_minutes"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={service?.duration_minutes ?? 45}
            required
          />
        </Field>
        <Field label="Preço (R$)">
          <input
            className="input"
            name="price"
            inputMode="decimal"
            defaultValue={service ? (service.price_cents / 100).toFixed(2).replace(".", ",") : ""}
            placeholder="35,00"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="h-4 w-4" />
          Ativo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_public" defaultChecked={service?.is_public ?? true} className="h-4 w-4" />
          Aparece na página de agendamento
        </label>
      </div>
      <SubmitButton>{service ? "Salvar alterações" : "Cadastrar serviço"}</SubmitButton>
    </ActionForm>
  );
}
