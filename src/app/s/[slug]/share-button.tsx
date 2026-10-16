"use client";

import { useState } from "react";

export function ShareButton({ title, color }: { title: string; color: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={share} aria-label="Compartilhar"
      className="btn rounded-full px-3 py-2 text-white sm:px-4 sm:py-2.5" style={{ backgroundColor: color }}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      <span className={copied ? "" : "hidden sm:inline"}>{copied ? "Link copiado!" : "Compartilhar"}</span>
    </button>
  );
}
