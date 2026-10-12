import type { Metadata, Viewport } from "next";
import { Caveat, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import "./globals.css";

/**
 * Tipografia:
 * - Plus Jakarta Sans (interface e leitura funcional)
 * - Newsreader (serifa editorial científica para títulos e nomes de táxons)
 * - Caveat (anotações de bancada)
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  // Só anotações decorativas: não disputa banda com a fonte principal no carregamento crítico.
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Microcosmos — Além das Lentes",
    template: "%s · Microcosmos",
  },
  description:
    "Publicação científica autoral da biomédica Ynara Raíssa Nwokolo sobre parasitologia e o mundo invisível além das lentes.",
};

export const viewport: Viewport = {
  themeColor: "#F2F2F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${newsreader.variable} ${caveat.variable}`}>
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
