import Link from "next/link";
import type { Appointment } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatDateLong, formatTime, toLocalDate } from "@/lib/time";
import { StatusBadge } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { rescheduleAppointment, saveInternalNote, setAppointmentStatus } from "./actions";

function StatusButton({ id, status, label, confirm }: { id: string; status: string; label: string; confirm?: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {confirm ? (
        <ConfirmButton message={confirm} className="btn-danger px-3 py-1.5">
          {label}
        </ConfirmButton>
      ) : (
        <SubmitButton className="btn-secondary px-3 py-1.5" pendingText="…">
          {label}
        </SubmitButton>
      )}
    </form>
  );
}

export function AppointmentCard({
  appt,
  timeZone,
  showDate = false,
  showProfessional = false,
}: {
  appt: Appointment;
  timeZone: string;
  showDate?: boolean;
  showProfessional?: boolean;
}) {
  const active = appt.status === "pending" || appt.status === "confirmed";
  const customer = appt.customers;
  return (
    <details className={`card group py-3 ${appt.status === "canceled" ? "opacity-60" : ""}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <div className="w-14 shrink-0 text-center">
          <p className="text-base font-semibold">{formatTime(appt.starts_at, timeZone)}</p>
          <p className="text-xs text-stone-500">{formatTime(appt.ends_at, timeZone)}</p>
        </div>
        <div className="min-w-0 flex-1">
          {showDate && <p className="text-xs capitalize text-stone-500">{formatDateLong(appt.starts_at, timeZone)}</p>}
          <p className="truncate font-medium">{customer?.name ?? "Cliente"}</p>
          <p className="truncate text-sm text-stone-600">
            {appt.service_name}
            {showProfessional && appt.professionals?.name && ` · com ${appt.professionals.name}`}
          </p>
        </div>
        <StatusBadge status={appt.status} />
      </summary>

      <div className="mt-4 space-y-4 border-t border-stone-100 pt-4 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-stone-600">
          {customer && (
            <>
              <Link href={`/painel/clientes/${customer.id}`} className="font-medium text-brand-700 hover:underline">
                Ver cliente
              </Link>
              <a href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer" className="hover:underline">
                {formatPhone(customer.phone)} (WhatsApp)
              </a>
            </>
          )}
          {appt.price_cents > 0 && <span>{formatMoney(appt.price_cents)}</span>}
          <span>{appt.source === "online" ? "Agendado pelo link" : "Criado no painel"}</span>
        </div>
        {appt.customer_note && (
          <p className="rounded-lg bg-stone-50 px-3 py-2">
            <span className="text-stone-500">Observação da cliente: </span>
            {appt.customer_note}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {appt.status === "pending" && <StatusButton id={appt.id} status="confirmed" label="Confirmar" />}
          {active && <StatusButton id={appt.id} status="completed" label="Concluído" />}
          {active && <StatusButton id={appt.id} status="no_show" label="Faltou" />}
          {active && (
            <StatusButton id={appt.id} status="canceled" label="Cancelar" confirm="Cancelar este agendamento?" />
          )}
          {!active && <StatusButton id={appt.id} status="confirmed" label="Reabrir" />}
        </div>

        {active && (
          <ActionForm action={rescheduleAppointment} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={appt.id} />
            <label>
              <span className="label">Nova data</span>
              <input
                className="input py-1.5"
                type="date"
                name="date"
                defaultValue={toLocalDate(new Date(appt.starts_at), timeZone)}
                required
              />
            </label>
            <label>
              <span className="label">Horário</span>
              <input className="input py-1.5" type="time" name="time" defaultValue={formatTime(appt.starts_at, timeZone)} required />
            </label>
            <SubmitButton className="btn-secondary">Alterar horário</SubmitButton>
          </ActionForm>
        )}

        <ActionForm action={saveInternalNote} className="space-y-2">
          <input type="hidden" name="id" value={appt.id} />
          <label className="block">
            <span className="label">Observação interna (a cliente não vê)</span>
            <textarea className="input" name="internal_note" rows={2} maxLength={1000} defaultValue={appt.internal_note ?? ""} />
          </label>
          <SubmitButton className="btn-secondary">Salvar observação</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
