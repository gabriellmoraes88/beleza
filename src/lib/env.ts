function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export const SUPABASE_URL = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_PUBLISHABLE_KEY = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

// Endereço final do site em produção. bellink.com.br (sem www) redireciona para cá, e o
// WhatsApp não segue esse redirecionamento ao montar a prévia do link.
const PRODUCTION_URL = "https://www.bellink.com.br";

export const SITE_URL = () => {
  const fallback =
    process.env.VERCEL_ENV === "production"
      ? PRODUCTION_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
  return (process.env.NEXT_PUBLIC_SITE_URL ?? fallback).replace(/\/$/, "");
};
