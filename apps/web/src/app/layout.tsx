import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

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
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
