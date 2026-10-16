import "server-only";

// Cliente mínimo da API v3 do Asaas. Chamado apenas no servidor.
// Docs: https://docs.asaas.com/reference

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS"
  | (string & {});

export interface AsaasPayment {
  object: "payment";
  id: string;
  customer: string;
  subscription?: string | null;
  value: number;
  status: AsaasPaymentStatus;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  invoiceUrl?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
}

export interface AsaasSubscription {
  object: "subscription";
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | (string & {});
  deleted?: boolean;
  externalReference?: string | null;
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

/** Situação da configuração, sem nunca expor a chave. */
export function asaasEnvironment() {
  const baseUrl = (process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3").replace(/\/$/, "");
  return {
    hasKey: !!process.env.ASAAS_API_KEY,
    hasWebhookToken: !!process.env.ASAAS_WEBHOOK_TOKEN,
    sandbox: baseUrl.includes("sandbox"),
    baseUrl,
  };
}

function config() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  const baseUrl = (process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3").replace(/\/$/, "");
  return { apiKey, baseUrl };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { apiKey, baseUrl } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bellink-saas",
      access_token: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const description = json?.errors?.[0]?.description ?? `Erro ${res.status} no Asaas`;
    throw new AsaasError(description, res.status, json);
  }
  return json as T;
}

export const asaas = {
  createCustomer: (input: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    externalReference: string;
  }) => request<{ id: string }>("POST", "/customers", input),

  createSubscription: (input: {
    customer: string;
    billingType: "UNDEFINED" | "BOLETO" | "PIX" | "CREDIT_CARD";
    value: number;
    nextDueDate: string;
    cycle: "MONTHLY";
    description: string;
    externalReference: string;
  }) => request<AsaasSubscription>("POST", "/subscriptions", input),

  getSubscription: (id: string) => request<AsaasSubscription>("GET", `/subscriptions/${id}`),

  cancelSubscription: (id: string) => request<{ deleted: boolean }>("DELETE", `/subscriptions/${id}`),

  /** Saldo da conta; usado pelo admin para testar se a chave funciona. */
  getBalance: () => request<{ balance: number }>("GET", "/finance/balance"),

  listSubscriptionPayments: (id: string) =>
    request<{ data: AsaasPayment[] }>("GET", `/subscriptions/${id}/payments?limit=20`),
};
