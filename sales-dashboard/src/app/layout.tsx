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
  metadataBase: new URL('https://home-sales.nextcode.ltd'),
  title: {
    default: '沖縄不動産 営業ダッシュボード',
    template: '%s | 沖縄不動産 営業ダッシュボード',
  },
  description: '沖縄県の不動産物件データを分析し、営業活動を支援する社内ダッシュボード',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://home-sales.nextcode.ltd',
    siteName: '沖縄不動産 営業ダッシュボード',
    title: '沖縄不動産 営業ダッシュボード',
    description: '沖縄県の不動産物件データを分析し、営業活動を支援する社内ダッシュボード',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '沖縄不動産 営業ダッシュボード',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '沖縄不動産 営業ダッシュボード',
    description: '沖縄県の不動産物件データを分析し、営業活動を支援する社内ダッシュボード',
    images: ['/og-image.png'],
  },
};

import Providers from "./providers";
import SidebarWrapper from "@/components/sidebar-wrapper";
import { Toaster } from "sonner";
import { getCspNonce } from "@/lib/csp";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request nonce so child <Script> tags can pick it up
  // from a data attribute when needed. The CSP enforcing pass will
  // start using it directly.
  const nonce = await getCspNonce();
  return (
    <html lang="ja" suppressHydrationWarning data-csp-nonce={nonce ?? ''}>
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
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: 'text-sm',
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
