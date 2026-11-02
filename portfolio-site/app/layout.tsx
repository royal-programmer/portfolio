import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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

/** Display face (design system v2): editorial serif — the "legacy" voice. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EXPERIENCE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ExperienceProvider>
          <PersonaProvider>{children}</PersonaProvider>
        </ExperienceProvider>
      </body>
    </html>
  );
}
