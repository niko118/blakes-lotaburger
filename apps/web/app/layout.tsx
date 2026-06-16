import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { AuthSessionProvider } from "@components/session-provider";
import { Toaster } from "@components/ui/toaster";
import { buildThemeStyle } from "@lib/server/theme";
import "../globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "App",
  description: "Full-stack application with authentication and GraphQL",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeStyle = buildThemeStyle();

  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        {themeStyle && (
          <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
        )}
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
