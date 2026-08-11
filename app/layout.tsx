import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ClientBodyCleanup from "../components/client-body-cleanup";

export const metadata: Metadata = {
  title: "BlockQuest Fiesta PH — Registration",
  description: "Register for BlockQuest Fiesta PH and receive your QR pass.",
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
