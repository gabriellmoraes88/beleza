"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, Smartphone } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type State = "loading" | "installed" | "prompt" | "ios" | "manual" | "hidden";

// O Chrome pode disparar o evento antes do componente montar; guardamos aqui.
let deferred: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
}

function detect(): State {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /android/i.test(ua) ? "manual" : "hidden";
}

/** Botão para a dona colocar o painel do Bellink na tela inicial do celular. */
export function InstallApp() {
  const [state, setState] = useState<State>("loading");
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setState(detect()));
    const onPrompt = () => setState((s) => (s === "installed" ? s : "prompt"));
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    const event = deferred;
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setState(outcome === "accepted" ? "installed" : "manual");
  }

  if (state === "loading" || state === "installed" || state === "hidden") return null;

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Bellink na tela inicial</p>
          <p className="mt-0.5 text-sm text-stone-600">
            Abra sua agenda com um toque, como um aplicativo, sem precisar entrar no navegador.
          </p>
          {state === "prompt" && (
            <button type="button" onClick={install} className="btn-primary mt-3">
              Adicionar à tela inicial
            </button>
          )}
          {state === "ios" && !showSteps && (
            <button type="button" onClick={() => setShowSteps(true)} className="btn-primary mt-3">
              Adicionar à tela inicial
            </button>
          )}
          {state === "ios" && showSteps && (
            <ol className="mt-3 grid gap-2 text-sm text-stone-700">
              <li>
                <span className="font-semibold">1.</span> Toque em <Share className="inline h-4 w-4 align-[-3px]" aria-hidden />{" "}
                <strong>Compartilhar</strong>, na barra do Safari.
              </li>
              <li>
                <span className="font-semibold">2.</span> Escolha <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden />{" "}
                <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                <span className="font-semibold">3.</span> Toque em <strong>Adicionar</strong>.
              </li>
            </ol>
          )}
          {state === "manual" && (
            <p className="mt-2 text-sm text-stone-700">
              No menu do navegador (⋮), toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
