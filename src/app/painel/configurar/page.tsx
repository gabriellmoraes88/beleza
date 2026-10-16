import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudioContext } from "@/lib/studio";
import { SITE_URL } from "@/lib/env";
import { CreateStudioForm } from "./studio-form";

export const metadata: Metadata = { title: "Configurar studio" };

export default async function SetupPage() {
  const ctx = await getStudioContext();
  if (ctx.studio) redirect("/painel");
  return (
    <div className="pt-6">
      <p className="text-sm font-medium text-brand-700">Passo 1 de 3</p>
      <h1 className="mt-1 text-2xl font-semibold">Vamos criar seu studio</h1>
      <p className="mb-5 mt-1 text-stone-600">
        Leva menos de um minuto. Depois você cadastra os serviços e confere seus horários.
      </p>
      <CreateStudioForm siteUrl={SITE_URL()} />
    </div>
  );
}
