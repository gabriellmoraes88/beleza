import { requirePlatformAdmin } from "../guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasEnvironment } from "@/lib/asaas";
import { graceDays } from "@/lib/billing";
import { headers } from "next/headers";
import { formatMoney } from "@/lib/format";
import { daysFromNow } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/form";
import { CopyButton } from "@/components/copy-button";
import { fmtDateTime } from "../lib";
import { reconcileNow, testAsaas, updatePlan } from "../actions";

function Check({ ok, label, okText, missingText }: { ok: boolean; label: string; okText: string; missingText: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-stone-700">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        {ok ? okText : missingText}
      </span>
    </li>
  );
}

export default async function AdminSettings() {
  await requirePlatformAdmin(); // também protegido pelo layout; checado aqui de novo por segurança
  const db = createAdminClient();
  const env = asaasEnvironment();
  // Endereço pelo qual o admin abriu o painel (o domínio público, não o endereço interno da Vercel).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/asaas`;

  const [{ data: plan }, { count: received7d }, { count: pending }, { data: failed }, { data: last }] = await Promise.all([
    db.from("plans").select("name, price_cents, trial_days").eq("code", "studio").maybeSingle(),
    db.from("asaas_webhook_events").select("id", { count: "exact", head: true }).gte("received_at", daysFromNow(-7).toISOString()),
    db.from("asaas_webhook_events").select("id", { count: "exact", head: true }).is("processed_at", null),
    db
      .from("asaas_webhook_events")
      .select("id, event, attempts, last_error, received_at")
      .is("processed_at", null)
      .gt("attempts", 0)
      .order("received_at", { ascending: false })
      .limit(5),
    db.from("asaas_webhook_events").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Configurações</h1>
        <p className="mt-1 text-sm text-stone-600">Plano, cobrança e conexão com o Asaas.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Plano</h2>
          <p className="mt-1 text-sm text-stone-600">
            Hoje: {plan ? `${formatMoney(plan.price_cents)} por mês, ${plan.trial_days} dias de teste` : "plano não encontrado"}.
          </p>
          <ActionForm action={updatePlan} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Preço por mês (R$)</span>
                <input
                  className="input"
                  name="price"
                  inputMode="decimal"
                  defaultValue={plan ? (plan.price_cents / 100).toFixed(2).replace(".", ",") : ""}
                  required
                />
              </label>
              <label className="block">
                <span className="label">Dias de teste grátis</span>
                <input className="input" name="trial_days" type="number" min={0} max={90} defaultValue={plan?.trial_days ?? 14} required />
              </label>
            </div>
            <p className="text-xs text-stone-500">
              O novo preço aparece na página de vendas e vale para quem assinar a partir de agora. Quem já assina continua
              no valor antigo. Tolerância de atraso: {graceDays()} dias.
            </p>
            <SubmitButton>Salvar plano</SubmitButton>
          </ActionForm>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-stone-900">Asaas</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                env.sandbox ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              }`}
            >
              {env.sandbox ? "Modo de teste (sandbox)" : "Produção"}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            <Check ok={env.hasKey} label="Chave da API" okText="Cadastrada" missingText="Falta cadastrar" />
            <Check ok={env.hasWebhookToken} label="Token do webhook" okText="Cadastrado" missingText="Falta cadastrar" />
            <Check
              ok={!!process.env.CRON_SECRET}
              label="Conferência automática diária"
              okText="Ligada"
              missingText="Falta CRON_SECRET"
            />
          </ul>
          <ActionForm action={testAsaas} className="mt-3">
            <SubmitButton className="btn-secondary" pendingText="Testando…">
              Testar conexão
            </SubmitButton>
          </ActionForm>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <p className="label">Endereço do webhook (cole no Asaas)</p>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={webhookUrl} />
              <CopyButton text={webhookUrl} label="Copiar" />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-stone-900">Avisos de pagamento do Asaas</h2>
            <p className="mt-1 text-sm text-stone-600">
              {received7d ?? 0} recebidos nos últimos 7 dias · último em {fmtDateTime(last?.received_at)} · {pending ?? 0} aguardando
            </p>
          </div>
          <ActionForm action={reconcileNow}>
            <SubmitButton className="btn-secondary" pendingText="Conferindo…">
              Conferir pagamentos agora
            </SubmitButton>
          </ActionForm>
        </div>
        {(failed ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-rose-100 bg-rose-50/40 text-sm">
            {(failed ?? []).map((f) => (
              <li key={f.id} className="px-3 py-2.5">
                <p className="font-medium text-rose-800">
                  {f.event} · {f.attempts} tentativa(s)
                </p>
                <p className="text-xs text-rose-700">
                  {fmtDateTime(f.received_at)} · {f.last_error}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-stone-900">Como ligar o Asaas</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700">
          <li>
            No Asaas, vá em <strong>Integrações → Chaves de API</strong> e gere uma chave.
          </li>
          <li>
            Na Vercel, abra o projeto → <strong>Settings → Environment Variables</strong> e crie <code>ASAAS_API_KEY</code> com essa
            chave. Para cobrar de verdade, crie também <code>ASAAS_API_URL</code> com <code>https://api.asaas.com/v3</code>.
          </li>
          <li>
            Invente uma senha longa e crie <code>ASAAS_WEBHOOK_TOKEN</code> com ela na Vercel.
          </li>
          <li>
            No Asaas, em <strong>Integrações → Webhooks</strong>, cole o endereço acima, use a mesma senha no campo
            “Token de autenticação” e marque os eventos de <strong>Cobranças</strong> e <strong>Assinaturas</strong>.
          </li>
          <li>
            Na Vercel, vá em <strong>Deployments</strong> e clique em <strong>Redeploy</strong>. Depois volte aqui e clique em
            “Testar conexão”.
          </li>
        </ol>
        <p className="mt-3 text-xs text-stone-500">
          As chaves ficam guardadas só na Vercel. Nem este painel nem o navegador conseguem lê-las.
        </p>
      </section>
    </div>
  );
}
