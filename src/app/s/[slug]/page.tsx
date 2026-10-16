import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsappLink } from "@/lib/phone";
import type { PublicStudio } from "@/lib/types";
import { todayIn } from "@/lib/time";
import { BookingFlow } from "./booking-flow";

const getStudio = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_studio", { p_slug: slug });
  return (data as PublicStudio | null) ?? null;
});

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await getStudio(slug);
  if (!studio) return { title: "Studio não encontrado" };
  return {
    title: `Agende com ${studio.name}`,
    description: studio.description ?? `Agende seu horário online com ${studio.name}.`,
  };
}

export default async function PublicStudioPage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const studio = await getStudio(slug);
  if (!studio) notFound();

  const color = studio.primary_color || "#9a5b60";

  return (
    <main className="flex-1 pb-16" style={{ ["--accent" as string]: color }}>
      <header className="px-4 pb-6 pt-8 text-center text-white" style={{ backgroundColor: color }}>
        {studio.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={studio.logo_url}
            alt=""
            className="mx-auto mb-3 h-20 w-20 rounded-full border-4 border-white/70 object-cover"
          />
        )}
        <h1 className="text-2xl font-semibold">{studio.name}</h1>
        {studio.description && <p className="mx-auto mt-1 max-w-md text-sm text-white/90">{studio.description}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-white/90">
          {(studio.address || studio.city) && <span>{[studio.address, studio.city].filter(Boolean).join(" · ")}</span>}
          {studio.instagram && (
            <a
              className="underline"
              href={`https://instagram.com/${studio.instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              @{studio.instagram.replace(/^@/, "")}
            </a>
          )}
          {studio.whatsapp && (
            <a className="underline" href={whatsappLink(studio.whatsapp)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto -mt-3 max-w-lg px-4">
        {!studio.accepting_bookings ? (
          <div className="card text-center">
            <p className="font-medium">O agendamento online está indisponível no momento.</p>
            {studio.whatsapp && (
              <a
                href={whatsappLink(studio.whatsapp, "Olá! Gostaria de agendar um horário.")}
                className="btn-primary mt-4"
                style={{ backgroundColor: color }}
              >
                Falar no WhatsApp
              </a>
            )}
          </div>
        ) : studio.services.length === 0 ? (
          <div className="card text-center text-stone-600">Nenhum serviço disponível para agendamento online.</div>
        ) : (
          <BookingFlow studio={studio} today={todayIn(studio.timezone)} />
        )}
      </div>
    </main>
  );
}
