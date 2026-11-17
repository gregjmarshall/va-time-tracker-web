import Link from 'next/link'
import { getDoc } from './docs'
import { HELP_SECTIONS } from './sections'

export default function HelpHome() {
  return (
    <div>
      <h1 className="text-3xl font-medium text-foreground">How can we help?</h1>
      <p className="text-sm text-muted-foreground mt-1">Guides for every part of pip, grouped by role. Press <kbd className="num rounded border border-white/15 px-1">/</kbd> to search.</p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {HELP_SECTIONS.map((s) => (
          <section key={s.title} className="rounded-lg glass-card p-5 border-t-2" style={{ borderTopColor: s.accent }}>
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground/80">{s.title}</h2>
            <ul className="mt-3 space-y-1">
              {s.slugs.map((slug) => (
                <li key={slug}>
                  <Link href={`/help/${slug}`} className="text-sm text-foreground/85 hover:text-foreground hover:underline underline-offset-4">
                    {getDoc(slug)!.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
