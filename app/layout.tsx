import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import PublicChrome from "../components/PublicChrome";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Steve Gregson",
  description: "The Steve Gregson Archive",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PublicChrome>
          {children}
        </PublicChrome>
      </body>
    </html>
  );
}