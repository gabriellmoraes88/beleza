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

  const color = studio.primary_color || "#292524";

  const instagram = studio.instagram?.replace(/^@/, "");
  const location = [studio.address, studio.city].filter(Boolean).join(" · ");
  const initials = studio.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <main className="flex-1 bg-white pb-16" style={{ ["--accent" as string]: color }}>
      <div className="h-24 bg-stone-100 sm:h-36" />

      <div className="mx-auto max-w-5xl px-4">
        <header className="flex flex-col gap-3 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:gap-5">
          {studio.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studio.logo_url}
              alt=""
              className="-mt-10 h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow-sm sm:-mt-12 sm:h-24 sm:w-24"
            />
          ) : (
            <div
              className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white text-2xl font-semibold text-white shadow-sm sm:-mt-12 sm:h-24 sm:w-24"
              style={{ backgroundColor: color }}
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{studio.name}</h1>
            {location && <p className="mt-1 text-sm text-stone-600">{location}</p>}
          </div>
        </header>

        <div className="grid gap-8 pt-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {!studio.accepting_bookings ? (
              <div className="rounded-2xl border border-stone-200 p-5 text-center">
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
              <div className="rounded-2xl border border-stone-200 p-5 text-center text-stone-600">
                Nenhum serviço disponível para agendamento online.
              </div>
            ) : (
              <BookingFlow studio={studio} today={todayIn(studio.timezone)} />
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-stone-200 p-5">
              <h2 className="font-semibold text-stone-900">Sobre</h2>
              {studio.description ? (
                <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{studio.description}</p>
              ) : (
                <p className="mt-2 text-sm text-stone-600">Agende seu horário online, sem precisar de cadastro.</p>
              )}
              <dl className="mt-4 space-y-3 text-sm">
                {location && (
                  <div>
                    <dt className="text-stone-500">Endereço</dt>
                    <dd className="text-stone-900">{location}</dd>
                  </div>
                )}
                {instagram && (
                  <div>
                    <dt className="text-stone-500">Instagram</dt>
                    <dd>
                      <a
                        className="text-stone-900 underline"
                        href={`https://instagram.com/${instagram}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{instagram}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {studio.whatsapp && (
                <a
                  href={whatsappLink(studio.whatsapp, "Olá! Tenho uma dúvida.")}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary mt-4 w-full"
                >
                  Falar no WhatsApp
                </a>
              )}
            </div>
            <p className="text-center text-xs text-stone-400">
              Agendamento por <span className="font-medium text-stone-500">Bellink</span>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
