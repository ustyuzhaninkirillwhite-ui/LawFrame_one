import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const displayFont = IBM_Plex_Serif({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LexFrame Stage 0",
  description: "Contract-driven Stage 0 foundation for the LexFrame legal automation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
