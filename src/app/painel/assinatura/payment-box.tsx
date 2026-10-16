"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, QrCode } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/types";
import { checkPayment, loadPix, type PixResult } from "./pay-actions";

type Method = "pix" | "card";

export function PaymentBox({
  paymentId,
  amount,
  payWithCard,
}: {
  paymentId: string;
  amount: string;
  payWithCard: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [method, setMethod] = useState<Method>("pix");

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <p className="mb-3 font-semibold">Pagar {amount}</p>
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-2">
        <Tab active={method === "pix"} onClick={() => setMethod("pix")} icon={<QrCode className="h-5 w-5" />}>
          Pix
        </Tab>
        <Tab active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard className="h-5 w-5" />}>
          Cartão
        </Tab>
      </div>
      {method === "pix" ? <PixPanel paymentId={paymentId} /> : <CardPanel payWithCard={payWithCard} amount={amount} />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
        active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PixPanel({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pix, setPix] = useState<PixResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPix(paymentId).then((r) => alive && setPix(r));
    return () => {
      alive = false;
    };
  }, [paymentId]);

  // Enquanto o QR Code está na tela, confere a cada 5 segundos se o Pix caiu.
  const waiting = !!pix && "code" in pix;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const { paid } = await checkPayment(paymentId);
      if (paid) {
        clearInterval(timer);
        setPix({ paid: true });
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [waiting, paymentId, router]);

  if (!pix) {
    return (
      <div className="flex flex-col items-center gap-3 py-6" aria-busy="true">
        <div className="h-48 w-48 animate-pulse rounded-xl bg-stone-100" />
        <p className="text-sm text-stone-500">Gerando o Pix…</p>
      </div>
    );
  }
  if ("paid" in pix) return <Alert tone="success">Pagamento recebido! Obrigado.</Alert>;
  if ("error" in pix) return <Alert tone="error">{pix.error}</Alert>;

  return (
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${pix.image}`}
        alt="QR Code do Pix"
        className="h-52 w-52 rounded-xl border border-stone-200 bg-white p-2"
      />
      <p className="mt-3 text-sm text-stone-600">Abra o app do seu banco, escolha Pix e aponte a câmera para o código.</p>
      <p className="mt-4 text-sm font-medium">Ou use o Pix copia e cola</p>
      <div className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2 text-left font-mono text-xs break-all text-stone-700">
        {pix.code}
      </div>
      <button
        type="button"
        className="btn-primary mt-3 w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(pix.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? "Código copiado!" : "Copiar código Pix"}
      </button>
      <p className="mt-4 flex items-center gap-2 text-sm text-stone-500" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Aguardando o pagamento. Esta tela atualiza sozinha.
      </p>
    </div>
  );
}

function formatCardNumber(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function CardPanel({
  payWithCard,
  amount,
}: {
  payWithCard: (state: ActionState, formData: FormData) => Promise<ActionState>;
  amount: string;
}) {
  const [state, action, pending] = useActionState(payWithCard, undefined);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");

  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    // onSubmit em vez de action={...}: assim o formulário não se apaga se o cartão for recusado.
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <Field label="Número do cartão">
        <input
          className="input"
          name="number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          value={number}
          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
          required
        />
      </Field>
      <Field label="Nome impresso no cartão">
        <input className="input" name="holder_name" autoComplete="cc-name" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Validade">
          <input
            className="input"
            name="expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            required
          />
        </Field>
        <Field label="CVV">
          <input className="input" name="ccv" inputMode="numeric" autoComplete="cc-csc" maxLength={4} placeholder="123" required />
        </Field>
      </div>
      <p className="pt-2 text-sm font-medium text-stone-700">Dados do titular</p>
      <Field label="CPF ou CNPJ do titular">
        <input className="input" name="cpf_cnpj" inputMode="numeric" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CEP">
          <input className="input" name="postal_code" inputMode="numeric" autoComplete="postal-code" required />
        </Field>
        <Field label="Número">
          <input className="input" name="address_number" placeholder="Ex.: 120" required />
        </Field>
      </div>
      <Field label="Celular com DDD">
        <input className="input" name="phone" inputMode="tel" autoComplete="tel-national" required />
      </Field>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Processando pagamento…" : `Pagar ${amount}`}
      </button>
      <p className="flex items-start gap-2 text-xs text-stone-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pagamento processado pelo Asaas. Os dados do cartão não ficam salvos no Bellink. As próximas mensalidades são
        cobradas automaticamente neste cartão.
      </p>
    </form>
  );
}
