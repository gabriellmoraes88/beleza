// Utilitários de data/hora sempre no fuso do studio (sem dependências externas).

export const DEFAULT_TZ = "America/Sao_Paulo";

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Diferença (ms) entre o horário de parede do fuso e UTC naquele instante. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-16" + "14:30" no fuso -> Date (instante UTC). */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  const result = new Date(guess - offset);
  // Ajuste para transições de horário de verão.
  const offset2 = tzOffsetMs(result, timeZone);
  return offset2 === offset ? result : new Date(guess - offset2);
}

/** Data local (YYYY-MM-DD) de um instante no fuso. */
export function toLocalDate(date: Date, timeZone: string): string {
  const p = partsInTz(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayIn(timeZone: string): string {
  return toLocalDate(new Date(), timeZone);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Início (domingo) da semana da data. */
export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -weekdayOf(dateStr));
}

/** Intervalo [início, fim) de um dia local em UTC. */
export function dayRangeUtc(dateStr: string, timeZone: string): [Date, Date] {
  return [zonedToUtc(dateStr, "00:00", timeZone), zonedToUtc(addDays(dateStr, 1), "00:00", timeZone)];
}

export function formatTime(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatDateLong(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** Formata uma data local "YYYY-MM-DD" sem conversão de fuso. */
export function formatLocalDate(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function isValidDateStr(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Instante deslocado N dias a partir de agora. */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}
