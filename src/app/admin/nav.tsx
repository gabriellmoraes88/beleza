"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/studios", label: "Studios" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
