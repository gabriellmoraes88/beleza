import Link from "next/link";
import { Logo } from "@/components/logo";
import { getStudioContext } from "@/lib/studio";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SideNav } from "./nav";
import { AccessBanner } from "./access-banner";

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const ctx = await getStudioContext();

  if (!ctx.studio) {
    return (
      <div className="flex-1">
        <header className="flex items-center justify-between px-4 py-4">
          <Logo className="text-lg" markClassName="h-6 w-auto" />
          <form action={signOut}>
            <button className="btn-ghost">Sair</button>
          </form>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-16">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white p-4 lg:flex">
        <Link href="/painel" className="mb-1 block truncate text-lg font-semibold text-brand-700">
          {ctx.studio.name}
        </Link>
        <p className="mb-6 truncate text-xs text-stone-500">{ctx.user.email}</p>
        <SideNav />
        <form action={signOut} className="mt-auto">
          <button className="btn-ghost w-full justify-start">Sair</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
          <span className="truncate font-semibold text-brand-700">{ctx.studio.name}</span>
          <div className="flex items-center gap-1">
            <Link href="/painel/horarios" className="btn-ghost px-2.5">
              Horários
            </Link>
            <Link href="/painel/assinatura" className="btn-ghost px-2.5">
              Assinatura
            </Link>
          </div>
        </header>
        <AccessBanner subscription={ctx.subscription} hasAccess={ctx.hasAccess} suspended={!!ctx.studio.suspended_at} />
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
