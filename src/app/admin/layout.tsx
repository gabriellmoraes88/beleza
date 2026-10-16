import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "./guard";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Administração", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="flex-1 bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between py-3">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-stone-900">Bellink</span>
              <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Admin
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-stone-500 sm:block">{admin.email}</span>
              <Link href="/painel" className="btn-ghost px-2.5 py-1.5 text-sm">
                Meu painel
              </Link>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
