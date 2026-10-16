import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Bellink">
          <Logo size="md" />
        </Link>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
