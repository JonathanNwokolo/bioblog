import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import "./globals.css";

/**
 * Uma família para toda a interface (Plus Jakarta Sans, variável 200–800) e
 * Caveat só para anotações de bancada, o gesto manuscrito da referência.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
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
    <html lang="pt-BR" className={`${jakarta.variable} ${caveat.variable}`}>
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
