import type { Metadata } from "next";
import { requireStudio } from "@/lib/studio";
import { formatMoney } from "@/lib/format";
import { formatDateLong, formatLocalDate } from "@/lib/time";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Alert, Field, PageHeader } from "@/components/ui";
import { cancelSubscription, startSubscription } from "./actions";

export const metadata: Metadata = { title: "Assinatura" };

const SUB_LABEL: Record<string, string> = {
  trialing: "Teste grátis",
  active: "Ativa",
  past_due: "Pagamento em atraso",
  canceled: "Cancelada",
  expired: "Teste encerrado",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  CONFIRMED: "Pago",
  RECEIVED: "Pago",
  RECEIVED_IN_CASH: "Pago",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  DELETED: "Removida",
  AWAITING_RISK_ANALYSIS: "Em análise",
};

export default async function BillingPage() {
  const { supabase, studio, subscription, hasAccess, role } = await requireStudio();
  const tz = studio.timezone;
  const [{ data: plan }, { data: payments }] = await Promise.all([
    supabase.from("plans").select("name, price_cents").eq("code", subscription?.plan_code ?? "studio").maybeSingle(),
    supabase
      .from("payments")
      .select("id, status, value_cents, due_date, paid_at, invoice_url")
      .eq("studio_id", studio.id)
      .order("due_date", { ascending: false })
      .limit(24),
  ]);

  const hasAsaasSub = !!subscription?.asaas_subscription_id && subscription.status !== "canceled";
  const openPayment = (payments ?? []).find((p) => p.status === "PENDING" || p.status === "OVERDUE");

  return (
    <div className="max-w-2xl">
      <PageHeader title="Assinatura" />

      <div className="card mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">Plano</p>
            <p className="text-lg font-semibold">{plan?.name ?? "Plano Studio"}</p>
            {plan && <p className="text-sm text-stone-600">{formatMoney(plan.price_cents)} por mês</p>}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              hasAccess ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {SUB_LABEL[subscription?.status ?? ""] ?? "—"}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-sm text-stone-600">
          {subscription?.status === "trialing" && subscription.trial_ends_at && (
            <p>Seu teste vai até {formatDateLong(subscription.trial_ends_at, tz)}.</p>
          )}
          {subscription?.current_period_end && (
            <p>Pago até {formatDateLong(subscription.current_period_end, tz)}.</p>
          )}
          {subscription?.status === "past_due" && subscription.grace_until && (
            <p>Regularize até {formatDateLong(subscription.grace_until, tz)} para não ter o acesso limitado.</p>
          )}
          {!hasAccess && <p className="text-rose-700">Acesso limitado. Seus dados estão preservados.</p>}
        </div>
        {openPayment?.invoice_url && (
          <a href={openPayment.invoice_url} target="_blank" rel="noreferrer" className="btn-primary mt-4">
            Pagar {formatMoney(openPayment.value_cents)}
          </a>
        )}
      </div>

      {!hasAsaasSub && role === "owner" && (
        <div className="card mb-5">
          <h2 className="font-semibold">Assinar</h2>
          <p className="mb-3 mt-1 text-sm text-stone-600">
            Pagamento mensal por Pix, boleto ou cartão, processado pelo Asaas.
            {subscription?.status === "trialing" && " A primeira cobrança vence no fim do seu teste."}
          </p>
          <ActionForm action={startSubscription} className="space-y-3">
            <Field label="Nome ou razão social para a cobrança">
              <input className="input" name="name" defaultValue={studio.owner_name ?? studio.name} required />
            </Field>
            <Field label="CPF ou CNPJ" hint="Exigido pelo Asaas para emitir a cobrança.">
              <input className="input" name="cpf_cnpj" inputMode="numeric" required />
            </Field>
            <SubmitButton pendingText="Criando assinatura…">Assinar agora</SubmitButton>
          </ActionForm>
        </div>
      )}

      <h2 className="mb-2 font-semibold">Histórico de cobranças</h2>
      {!payments?.length ? (
        <Alert>Nenhuma cobrança ainda.</Alert>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{formatMoney(p.value_cents)}</p>
                <p className="text-stone-600">
                  Vencimento {p.due_date ? formatLocalDate(p.due_date, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-stone-600">{PAYMENT_LABEL[p.status] ?? p.status}</span>
                {p.invoice_url && (
                  <a href={p.invoice_url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                    Fatura
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasAsaasSub && role === "owner" && (
        <form action={cancelSubscription} className="mt-8">
          <ConfirmButton message="Cancelar a assinatura? Você mantém o acesso até o fim do período pago e seus dados ficam preservados.">
            Cancelar assinatura
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
