"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Pixel da Meta (anúncios do Instagram/Facebook). O ID é público por natureza.
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1461356172557121";

// Só as páginas de divulgação. Painel, admin e páginas de agendamento dos studios
// (onde estão os dados dos clientes) nunca carregam o Pixel.
const TRACKED = new Set(["/", "/cadastro", "/entrar", "/recuperar-senha"]);

// Cookie curto gravado por signUp: marca o cadastro concluído uma única vez.
const SIGNUP_COOKIE = "bl_signup";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

// Mesmo código-base que a Meta fornece: cria a fila e carrega fbevents.js uma vez.
function pixel(onLoad?: () => void): Fbq {
  if (window.fbq) return window.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // Sem PageView automático em navegações internas e sem leitura automática da página.
  fbq.disablePushState = true;
  window.fbq = window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  if (onLoad) script.addEventListener("load", onLoad);
  document.head.appendChild(script);

  fbq("set", "autoConfig", false, PIXEL_ID);
  fbq("init", PIXEL_ID);
  return fbq;
}

const hasSignupFlag = () => document.cookie.split("; ").includes(`${SIGNUP_COOKIE}=1`);
// Só apaga depois que o fbevents.js carregou e enviou a fila; se a página mudar antes, tenta de novo.
const clearSignupFlag = () => {
  document.cookie = `${SIGNUP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
};

let signupSent = false;

export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (TRACKED.has(pathname)) pixel()("track", "PageView");
    else if (pathname.startsWith("/painel") && hasSignupFlag() && !signupSent) {
      signupSent = true;
      // Vindo de /cadastro o fbevents.js já está carregado (callMethod existe).
      const loaded = Boolean(window.fbq?.callMethod);
      pixel(clearSignupFlag)("track", "CompleteRegistration");
      if (loaded) clearSignupFlag();
    }
  }, [pathname]);

  return null;
}
