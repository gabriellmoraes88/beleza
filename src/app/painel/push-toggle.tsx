"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { getPushKey, removePushSubscription, savePushSubscription, sendTestPush } from "./push-actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function detect(): Promise<State> | State {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return navigator.serviceWorker
    .getRegistration("/")
    .then((reg) => reg?.pushManager.getSubscription())
    .then(async (sub) => {
      if (!sub) return "off";
      // Cadastra de novo no servidor: o aparelho pode ter sido ativado antes de a tabela existir.
      const { ok } = await savePushSubscription(sub.toJSON());
      return ok ? "on" : "off";
    });
}

/** Liga ou desliga os avisos de agendamento neste aparelho. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    Promise.resolve(detect()).then(setState, () => setState("unsupported"));
  }, []);

  function enable() {
    setError(null);
    startBusy(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const key = await getPushKey();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }));
        const { ok } = await savePushSubscription(sub.toJSON());
        if (!ok) throw new Error("save");
        setState("on");
        await test();
      } catch {
        setError("Não foi possível ativar os avisos neste aparelho. Tente de novo.");
      }
    });
  }

  async function test() {
    setNotice(null);
    setError(null);
    const sent = await sendTestPush();
    if (sent > 0) setNotice("Aviso de teste enviado. Ele chega em alguns segundos.");
    else setError("O aviso de teste não foi entregue. Toque em Desativar e depois em Ativar avisos de novo.");
  }

  function disable() {
    setError(null);
    setNotice(null);
    startBusy(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  if (state === "loading") return null;

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
          {state === "on" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Avisos no celular</p>
          <p className="mt-0.5 text-sm text-stone-600">
            {state === "on"
              ? "Ativados neste aparelho. Você recebe um aviso a cada agendamento novo, alterado ou cancelado."
              : "Receba um aviso neste aparelho a cada agendamento novo, alterado ou cancelado pelas clientes."}
          </p>
          {state === "ios-install" && (
            <p className="mt-2 text-sm text-stone-700">
              No iPhone: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
              Abra o Bellink pelo ícone na tela inicial e ative os avisos aqui.
            </p>
          )}
          {state === "unsupported" && (
            <p className="mt-2 text-sm text-stone-700">Este navegador não aceita avisos. Use o Chrome no Android ou no computador.</p>
          )}
          {state === "denied" && (
            <p className="mt-2 text-sm text-stone-700">
              Os avisos estão bloqueados para o Bellink neste navegador. Libere em Configurações do navegador → Notificações.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
          {notice && <p className="mt-2 text-sm text-stone-700">{notice}</p>}
          {state === "off" && (
            <button type="button" onClick={enable} disabled={busy} className="btn-primary mt-3">
              {busy ? "Ativando…" : "Ativar avisos"}
            </button>
          )}
          {state === "on" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => startBusy(test)} disabled={busy} className="btn-secondary">
                Enviar aviso de teste
              </button>
              <button type="button" onClick={disable} disabled={busy} className="btn-ghost">
                Desativar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
