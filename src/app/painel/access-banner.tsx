import Link from "next/link";
import type { Subscription } from "@/lib/types";

function daysLeft(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function AccessBanner({
  subscription,
  hasAccess,
  suspended,
}: {
  subscription: Subscription | null;
  hasAccess: boolean;
  suspended: boolean;
}) {
  if (suspended) {
    return (
      <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">
        Seu studio está suspenso. Seus dados estão preservados. Fale com o suporte.
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">
        Seu acesso está limitado e o agendamento online está pausado. Seus dados estão preservados.{" "}
        <Link href="/painel/assinatura" className="font-semibold underline">
          Regularizar assinatura
        </Link>
      </div>
    );
  }
  if (subscription?.status === "trialing") {
    const days = daysLeft(subscription.trial_ends_at);
    return (
      <div className="bg-brand-50 px-4 py-2 text-center text-sm text-brand-700">
        Teste grátis: {days} {days === 1 ? "dia restante" : "dias restantes"}.{" "}
        <Link href="/painel/assinatura" className="font-semibold underline">
          Assinar agora
        </Link>
      </div>
    );
  }
  if (subscription?.status === "past_due") {
    return (
      <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
        Há uma mensalidade em atraso.{" "}
        <Link href="/painel/assinatura" className="font-semibold underline">
          Ver pagamento
        </Link>
      </div>
    );
  }
  return null;
}
