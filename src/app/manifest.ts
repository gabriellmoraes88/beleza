import type { MetadataRoute } from "next";

// Permite instalar o painel na tela inicial do celular (necessário para avisos no iPhone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bellink",
    short_name: "Bellink",
    description: "Sua agenda no link da bio.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#292524",
    lang: "pt-BR",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
