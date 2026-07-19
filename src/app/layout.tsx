import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'

import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

import './globals.css'

const noto = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ORIPA — オンラインオリパ',
    template: '%s | ORIPA',
  },
  description:
    'ポケカ・遊戯王・ワンピース・MTG など、あらゆるトレカのオンラインオリパ。残り口数と排出確率をすべて公開しています。',
  openGraph: {
    title: 'ORIPA — オンラインオリパ',
    description: 'あらゆるトレカのオンラインオリパ。排出確率・残り在庫を全公開。',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#07070c',
  width: 'device-width',
  initialScale: 1,
  // 拡大は塞がない（アクセシビリティ）
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${noto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
