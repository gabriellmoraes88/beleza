import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsappLink } from "@/lib/phone";
import type { PublicStudio } from "@/lib/types";
import { todayIn } from "@/lib/time";
import { BookingFlow } from "./booking-flow";
import { ShareButton } from "./share-button";
import { PhotoGallery } from "./photo-gallery";
import { photoUrl } from "@/lib/photos";

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

  const photos = studio.photos ?? [];
  const instagram = studio.instagram?.replace(/^@/, "");
  const location = [studio.address, studio.city].filter(Boolean).join(" · ");
  const initials = studio.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <main className="flex-1 bg-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:pt-8">
        {/* Capa */}
        <section
          className={`grid items-center gap-6 rounded-3xl bg-stone-100 p-4 sm:p-8 ${photos.length > 0 ? "md:grid-cols-2" : "md:grid-cols-[1fr_auto]"}`}
        >
          <div className="min-w-0 p-2 sm:p-2">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">{studio.name}</h1>
            {location && <p className="mt-3 text-sm text-stone-600">{location}</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              <ShareButton title={studio.name} color={color} />
              <a href="#informacao" className="btn rounded-full border border-stone-300 bg-white text-stone-900">
                Informação
              </a>
              {studio.whatsapp && (
                <a
                  href={whatsappLink(studio.whatsapp, "Olá! Tenho uma dúvida.")}
                  target="_blank"
                  rel="noreferrer"
                  className="btn rounded-full border border-stone-300 bg-white text-stone-900"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
          {photos.length > 0 ? (
            <PhotoGallery urls={photos.map(photoUrl)} name={studio.name} />
          ) : studio.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studio.logo_url}
              alt=""
              className="hidden h-40 w-40 rounded-3xl bg-white object-cover shadow-sm md:block lg:h-52 lg:w-52"
            />
          ) : (
            <div
              className="hidden h-40 w-40 items-center justify-center rounded-3xl text-5xl font-semibold text-white shadow-sm md:flex lg:h-52 lg:w-52"
              style={{ backgroundColor: color }}
              aria-hidden
            >
              {initials}
            </div>
          )}
        </section>

        <div className="pt-8 sm:pt-10">
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

        {/* Informação */}
        <section id="informacao" className="mt-12 scroll-mt-6 border-t border-stone-200 pt-8">
          <h2 className="text-lg font-semibold text-stone-900">Informação</h2>
          <div className="mt-4 grid gap-6 text-sm sm:grid-cols-3">
            <div>
              <p className="text-stone-500">Sobre</p>
              <p className="mt-1 whitespace-pre-line text-stone-800">
                {studio.description || "Agende seu horário online, sem precisar de cadastro."}
              </p>
            </div>
            {location && (
              <div>
                <p className="text-stone-500">Endereço</p>
                <p className="mt-1 text-stone-800">{location}</p>
              </div>
            )}
            {(instagram || studio.whatsapp) && (
              <div>
                <p className="text-stone-500">Contato</p>
                <div className="mt-1 space-y-1">
                  {instagram && (
                    <a
                      className="block text-stone-800 underline"
                      href={`https://instagram.com/${instagram}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{instagram}
                    </a>
                  )}
                  {studio.whatsapp && (
                    <a
                      className="block text-stone-800 underline"
                      href={whatsappLink(studio.whatsapp, "Olá! Tenho uma dúvida.")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-10 text-center text-xs text-stone-400">
            Agendamento por <span className="font-medium text-stone-500">Bellink</span>
          </p>
        </section>
      </div>
    </main>
  );
}
