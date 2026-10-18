import Link from "next/link";
import type { Metadata } from "next";
import { RecoveryFlow } from "./recovery-flow";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Recuperar senha</h1>
      <RecoveryFlow />
      <p className="mt-4 text-center text-sm">
        <Link href="/entrar" className="text-stone-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
