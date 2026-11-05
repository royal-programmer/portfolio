import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { EXPERIENCE_BOOT_SCRIPT } from "@/lib/site/experience";
import { ExperienceProvider } from "./experience-provider";
import { PersonaProvider } from "./persona-provider";
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
};

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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before hydration (next/script keeps React from re-rendering a raw <script> on the client). */}
        <Script id="xp-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: EXPERIENCE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ExperienceProvider>
          <PersonaProvider>{children}</PersonaProvider>
        </ExperienceProvider>
      </body>
    </html>
  );
}
