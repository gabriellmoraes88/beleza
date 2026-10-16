"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, Contact, CreditCard, House, Sparkles, Store, Users } from "lucide-react";

const items = [
  { href: "/painel", label: "Início", Icon: House },
  { href: "/painel/agenda", label: "Agenda", Icon: CalendarDays },
  { href: "/painel/servicos", label: "Serviços", Icon: Sparkles },
  { href: "/painel/horarios", label: "Horários", Icon: Clock },
  { href: "/painel/equipe", label: "Equipe", Icon: Contact },
  { href: "/painel/clientes", label: "Clientes", Icon: Users },
  { href: "/painel/configuracoes", label: "Studio", Icon: Store },
  { href: "/painel/assinatura", label: "Assinatura", Icon: CreditCard },
];

function isActive(pathname: string, href: string) {
  return href === "/painel" ? pathname === href : pathname.startsWith(href);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
            isActive(pathname, item.href) ? "bg-brand-50 text-brand-700" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          <item.Icon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.9} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// Navegação compacta para celular: os 5 itens mais usados.
export function BottomNav() {
  const pathname = usePathname();
  const mobile = items.filter((i) =>
    ["/painel", "/painel/agenda", "/painel/servicos", "/painel/clientes", "/painel/configuracoes"].includes(i.href),
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {mobile.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-xs font-medium ${
            isActive(pathname, item.href) ? "text-brand-700" : "text-stone-500"
          }`}
        >
          <item.Icon aria-hidden className="h-6.5 w-6.5" strokeWidth={isActive(pathname, item.href) ? 2.2 : 1.8} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
