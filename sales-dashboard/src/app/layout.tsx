import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: '沖縄不動産 営業ダッシュボード',
    template: '%s | 沖縄不動産 営業ダッシュボード',
  },
  description: '沖縄県の不動産物件データを分析し、営業活動を支援する社内ダッシュボード',
  robots: { index: false, follow: false },
};

import Providers from "./providers";
import SidebarWrapper from "@/components/sidebar-wrapper";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <div className="flex min-h-screen bg-slate-950">
            <SidebarWrapper />
            <Header />
            <main className="flex-1 md:ml-64 pt-[104px] pb-12 overflow-y-auto h-screen">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
