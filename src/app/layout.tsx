import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description =
  "Agenda online para salões, barbearias, estúdios de tatuagem, manicures e esteticistas. Seu cliente agenda sozinho pelo seu link.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL()),
  title: { default: "Bellink · Sua agenda no link da bio.", template: "%s · Bellink" },
  description,
  openGraph: {
    siteName: "Bellink",
    title: "Bellink · Sua agenda no link da bio.",
    description,
    url: "/",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
