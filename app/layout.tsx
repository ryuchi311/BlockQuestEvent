import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ClientBodyCleanup from "../components/client-body-cleanup";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "BlockQuest Fiesta PH",
  description: "BlockQuest Fiesta PH Web Platform & Event Suite",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientBodyCleanup>{children}</ClientBodyCleanup>
      </body>
    </html>
  );
}
