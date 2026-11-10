import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import Script from "next/script";
import { EXPERIENCE_BOOT_SCRIPT } from "@/lib/site/experience";
import { ExperienceProvider } from "./experience-provider";
import { PersonaProvider } from "./persona-provider";
import { ServiceWorker } from "./service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The terminal's `lang bn` and `lang hi` (17-persona-views.md §12). They follow Geist Mono in the terminal's font stack, so Latin stays
 * mono and only the Bengali and Devanagari glyphs come from Noto. Not preloaded: the browser fetches a file only when a page shows
 * that script (unicode-range), so a visitor who never types `lang bn` never downloads it.
 */
const notoBengali = Noto_Sans_Bengali({ variable: "--font-noto-bn", subsets: ["bengali"], weight: "400", display: "swap", preload: false });
const notoDevanagari = Noto_Sans_Devanagari({ variable: "--font-noto-hi", subsets: ["devanagari"], weight: "400", display: "swap", preload: false });

/**
 * Display face (D38 round A feedback: "fancy but readable"): Fraunces, a
 * variable serif with optical sizes, a softness axis and "wonky" italics.
 * Large sizes get the high-contrast, soft cut; it stays legible small.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ratul Roy — one light, many colours",
  description:
    "Ratul Roy: engineer, trader, photographer — and more wavelengths on the way. Pick a colour to step into that world.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ratulroy", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/** The browser chrome takes the void while the page loads. */
export const viewport: Viewport = { themeColor: "#05060a" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The boot script stamps data-experience before hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${notoBengali.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before hydration (next/script keeps React from re-rendering a raw <script> on the client). */}
        <Script id="xp-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: EXPERIENCE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ExperienceProvider>
          <PersonaProvider>{children}</PersonaProvider>
        </ExperienceProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
