import type { Metadata } from 'next'
import Link from 'next/link'
import { PipMark, PipWordmark } from '@/components/brand/PipLogo'
import { allDocs } from './docs'
import { HELP_SECTIONS } from './sections'
import { HelpNav, type NavSection } from './HelpNav'
import { HelpSearch, type SearchItem } from './HelpSearch'
import { BackToApp } from './BackToApp'

export const metadata: Metadata = {
  title: { default: 'Help · pip', template: '%s · pip help' },
  description: 'How to use pip: timers, timesheets, clients, retainers, reports and more.',
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const docs = allDocs()
  const bySlug = new Map(docs.map((d) => [d.slug, d]))
  const nav: NavSection[] = HELP_SECTIONS.map((s) => ({
    title: s.title,
    accent: s.accent,
    pages: s.slugs.map((slug) => ({ slug, title: bySlug.get(slug)!.title })),
  }))
  const index: SearchItem[] = docs.flatMap((d) => [
    { href: `/help/${d.slug}`, title: d.title, section: d.section, text: d.text },
    ...d.headings.map((h) => ({ href: `/help/${d.slug}#${h.id}`, title: h.text, section: d.title, text: '' })),
  ])

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link href="/help" className="flex items-center gap-2.5 flex-shrink-0" aria-label="pip help home">
            <PipMark size={30} className="rounded-[7px]" />
            <PipWordmark height={18} className="text-foreground hidden sm:block" />
            <span className="text-sm font-semibold text-muted-foreground">Help</span>
          </Link>
          <div className="flex-1 min-w-0 flex justify-end sm:justify-center">
            <HelpSearch items={index} />
          </div>
          <BackToApp />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 md:grid md:grid-cols-[14rem_1fr] md:gap-10">
        <HelpNav sections={nav} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
