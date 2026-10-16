import type { NextRequest } from "next/server";
import { getPlatformAdmin } from "../../guard";
import { BILLING_LABEL, PAYMENT_LABEL, type PaymentGroup, audit, currentMonth, fmtDate, fmtDay, isMonth, paymentGroup } from "../../lib";
import { loadPayments } from "../data";

const GROUPS: PaymentGroup[] = ["pago", "pendente", "atrasado", "estornado"];

// Planilha CSV no formato que o Excel em português abre direto (";" e vírgula decimal).
function cell(v: string): string {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v; // evita fórmulas no Excel
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return new Response("Not found", { status: 404 });

  const params = request.nextUrl.searchParams;
  const month = isMonth(params.get("mes")) ? params.get("mes")! : currentMonth();
  const group = GROUPS.find((g) => g === params.get("situacao"));
  const rows = (await loadPayments(month, group)).filter((p) => p.status !== "DELETED");

  const lines = [
    ["Studio", "Link", "Vencimento", "Valor (R$)", "Situação", "Forma", "Pago em", "Fatura"],
    ...rows.map((p) => [
      p.studio?.name ?? "",
      p.studio ? `/s/${p.studio.slug}` : "",
      fmtDay(p.due_date),
      (p.value_cents / 100).toFixed(2).replace(".", ","),
      PAYMENT_LABEL[paymentGroup(p.status)],
      BILLING_LABEL[p.billing_type ?? ""] ?? p.billing_type ?? "",
      p.paid_at ? fmtDate(p.paid_at) : "",
      p.invoice_url ?? "",
    ]),
  ];
  await audit(admin.id, "report.export", null, { month, group: group ?? "todos", rows: rows.length });

  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bellink-pagamentos-${month}${group ? `-${group}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
