/**
 * Normaliza telefones brasileiros para só dígitos com DDI 55.
 * Aceita "(11) 99999-0000", "11999990000", "+55 11 99999-0000".
 * Retorna null se não parecer um telefone válido.
 */
export function normalizePhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  const ddd = Number(digits.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return digits;
}

export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function whatsappLink(digits: string, text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
