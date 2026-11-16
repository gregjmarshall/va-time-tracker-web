'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface NavSection { title: string; accent: string; pages: { slug: string; title: string }[] }

/** Sidebar from md up; a collapsible "Contents" list on phones. */
export function HelpNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = sections.flatMap((s) => s.pages).find((p) => pathname === `/help/${p.slug}`)

  return (
    <nav aria-label="Help topics" className="mb-6 md:mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="help-nav-list"
        className="md:hidden w-full flex items-center justify-between rounded-xl glass-card px-4 py-3 text-sm font-semibold"
      >
        <span className="truncate">{current ? current.title : 'All topics'}</span>
        <span className="text-muted-foreground text-xs">{open ? 'Hide' : 'Contents'}</span>
      </button>
      <div id="help-nav-list" className={cn('md:block md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:pb-6 space-y-6 mt-3 md:mt-0', open ? 'block' : 'hidden')}>
        {sections.map((s) => (
          <div key={s.title}>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.accent }} />
              {s.title}
            </p>
            <ul className="space-y-0.5">
              {s.pages.map((p) => {
                const active = pathname === `/help/${p.slug}`
                return (
                  <li key={p.slug}>
                    <Link
                      href={`/help/${p.slug}`}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative block rounded-lg px-3 py-1.5 text-sm transition-colors',
                        active ? 'bg-white/10 text-white font-semibold' : 'text-muted-foreground hover:text-white hover:bg-white/5',
                      )}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-coral" />}
                      {p.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
