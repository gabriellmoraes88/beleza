"use client";

import { useRef, useState } from "react";

export function PhotoGallery({ urls, name }: { urls: string[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    const next = (i + urls.length) % urls.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-stone-200">
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex aspect-[16/9] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:aspect-[16/10]"
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`Foto ${i + 1} de ${name}`}
            className="h-full w-full shrink-0 snap-center object-cover"
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-stone-900 shadow sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-stone-900 shadow sm:flex"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {urls.map((url, i) => (
              <span key={url} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
