import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseMarkdown, type ParsedDoc } from './markdown'
import { HELP_SECTIONS } from './sections'

const CONTENT_DIR = path.join(process.cwd(), 'src/app/help/content')

export interface HelpDoc extends ParsedDoc { slug: string; section: string }

const cache = new Map<string, HelpDoc>()

/** Reads and renders content/<slug>.md (at build time; every page is statically generated). */
export function getDoc(slug: string): HelpDoc | null {
  const section = HELP_SECTIONS.find((s) => (s.slugs as readonly string[]).includes(slug))
  if (!section) return null
  const hit = cache.get(slug)
  if (hit) return hit
  const doc = { slug, section: section.title, ...parseMarkdown(readFileSync(path.join(CONTENT_DIR, `${slug}.md`), 'utf8')) }
  cache.set(slug, doc)
  return doc
}

export const allSlugs = (): string[] => HELP_SECTIONS.flatMap((s) => [...s.slugs])

export function allDocs(): HelpDoc[] {
  return allSlugs().map((slug) => getDoc(slug)!)
}
