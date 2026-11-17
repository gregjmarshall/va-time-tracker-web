import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/providers/providers'

const ui = Instrument_Sans({ variable: '--font-ui', subsets: ['latin'] })
const serif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' })
const num = IBM_Plex_Mono({ variable: '--font-num', subsets: ['latin'], weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'pip',
  description: 'Time tracking for your team',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${serif.variable} ${num.variable} h-full antialiased`}>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
