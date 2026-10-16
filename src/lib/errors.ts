// Traduz os códigos lançados pelas funções do banco em mensagens claras.
const MESSAGES: Record<string, string> = {
  SLOT_UNAVAILABLE: "Esse horário acabou de ficar indisponível. Escolha outro horário, por favor.",
  STUDIO_UNAVAILABLE: "O agendamento online deste studio está temporariamente indisponível.",
  STUDIO_NOT_FOUND: "Studio não encontrado.",
  SERVICE_NOT_FOUND: "Serviço não encontrado ou indisponível.",
  INVALID_NAME: "Informe seu nome (mínimo de 2 letras).",
  INVALID_PHONE: "Informe um telefone válido com DDD.",
  INVALID_NOTE: "A observação está muito longa.",
  TOO_MANY_BOOKINGS: "Você já tem vários agendamentos futuros neste studio. Fale com o studio para agendar mais.",
  SLUG_TAKEN: "Esse endereço já está em uso. Tente outro.",
  ALREADY_HAS_STUDIO: "Sua conta já tem um studio cadastrado.",
  HOURS_OVERLAP: "Há intervalos sobrepostos no mesmo dia. Revise os horários.",
  FORBIDDEN: "Você não tem permissão para isso.",
  NOT_AUTHENTICATED: "Faça login novamente.",
};

export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Algo deu errado. Tente novamente.";
  const msg = error.message ?? "";
  if (MESSAGES[msg]) return MESSAGES[msg];
  if (error.code === "23P01") return MESSAGES.SLOT_UNAVAILABLE;
  if (error.code === "23505") return "Esse registro já existe.";
  if (error.code === "42501") {
    return "Ação não permitida. Verifique se sua assinatura está ativa em Assinatura.";
  }
  if (error.code === "23514") return "Algum campo está com valor inválido.";
  return "Algo deu errado. Tente novamente.";
}
