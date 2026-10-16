import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-xl font-semibold text-brand-700">
          Bellink
        </Link>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
