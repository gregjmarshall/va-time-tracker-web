import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allSlugs, getDoc } from '../docs'
import styles from '../help.module.css'
import { WIDGET } from '../markdown'
import { PricingTable } from '../PricingTable'

const WIDGETS: Record<string, React.ReactNode> = { pricing: <PricingTable /> }

export const dynamicParams = false

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug)
  return doc ? { title: doc.title } : {}
}

export default async function HelpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getDoc(slug)
  if (!doc) notFound()

  const slugs = allSlugs()
  const i = slugs.indexOf(slug)
  const prev = i > 0 ? getDoc(slugs[i - 1]) : null
  const next = i < slugs.length - 1 ? getDoc(slugs[i + 1]) : null

  return (
    <article>
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">{doc.section}</p>
      <h1 className="mt-1 text-3xl font-normal text-foreground">{doc.title}</h1>
      {doc.headings.filter((h) => h.level === 2).length > 2 && (
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-2">
          {doc.headings.filter((h) => h.level === 2).map((h) => (
            <a key={h.id} href={`#${h.id}`} className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
              {h.text}
            </a>
          ))}
        </nav>
      )}
      <div className={`${styles.prose} mt-6 rounded-lg glass-card p-5 sm:p-7`}>
        {doc.html.split(new RegExp(WIDGET.source)).map((part, j) =>
          // split() with a capture group alternates html, widget name, html, …
          j % 2 === 1 ? <div key={j}>{WIDGETS[part]}</div> : <div key={j} dangerouslySetInnerHTML={{ __html: part }} />,
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        {prev ? (
          <Link href={`/help/${prev.slug}`} className="rounded-lg glass-card px-4 py-3 hover:bg-white/5">
            <span className="block text-xs text-muted-foreground">← Previous</span>
            <span className="font-medium text-foreground">{prev.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/help/${next.slug}`} className="rounded-lg glass-card px-4 py-3 text-right hover:bg-white/5">
            <span className="block text-xs text-muted-foreground">Next →</span>
            <span className="font-medium text-foreground">{next.title}</span>
          </Link>
        )}
      </div>
    </article>
  )
}
