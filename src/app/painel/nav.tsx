"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/painel", label: "Início", icon: "⌂" },
  { href: "/painel/agenda", label: "Agenda", icon: "▦" },
  { href: "/painel/servicos", label: "Serviços", icon: "✦" },
  { href: "/painel/horarios", label: "Horários", icon: "◷" },
  { href: "/painel/clientes", label: "Clientes", icon: "☺" },
  { href: "/painel/configuracoes", label: "Studio", icon: "⚙" },
  { href: "/painel/assinatura", label: "Assinatura", icon: "₢" },
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
          <span aria-hidden className="w-4 text-center">
            {item.icon}
          </span>
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
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive(pathname, item.href) ? "text-brand-700" : "text-stone-500"
          }`}
        >
          <span aria-hidden className="text-lg leading-none">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
