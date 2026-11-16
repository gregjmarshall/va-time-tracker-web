/**
 * A small build-time Markdown renderer for the help pages (our own trusted content only).
 * Supports: ## / ### headings (with ids), paragraphs, - and 1. lists, > callouts, | tables,
 * **bold**, *italic*, `code`, [links](/path), <!-- comments --> (dropped) and `::name` widget lines
 * (emitted as a WIDGET marker the page swaps for a component).
 */

export const WIDGET = /<!--widget:([a-z-]+)-->/

export interface Heading { id: string; text: string; level: 2 | 3 }
export interface ParsedDoc { title: string; html: string; headings: Heading[]; text: string }

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[*`"'“”‘’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const plain = (s: string) => s.replace(/\*\*|\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

function inline(src: string): string {
  let s = escape(src)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => {
    const external = /^https?:\/\//.test(href)
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
  })
  return s
}

export function parseMarkdown(md: string): ParsedDoc {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const out: string[] = []
  const headings: Heading[] = []
  const text: string[] = []
  let title = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) { i++; continue }

    if (t.startsWith('# ')) { title = t.slice(2).trim(); i++; continue }

    const widget = /^::([a-z-]+)$/.exec(t)
    if (widget) { out.push(`<!--widget:${widget[1]}-->`); i++; continue }

    const h = /^(##|###) (.+)$/.exec(t)
    if (h) {
      const level = h[1].length as 2 | 3
      const label = plain(h[2])
      const id = slugify(label)
      headings.push({ id, text: label, level })
      text.push(label)
      out.push(`<h${level} id="${id}"><a href="#${id}">${inline(h[2])}</a></h${level}>`)
      i++
      continue
    }

    if (/^- /.test(t) || /^\d+\. /.test(t)) {
      const ordered = /^\d+\. /.test(t)
      const items: string[] = []
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i].trim()) : /^- /.test(lines[i].trim()))) {
        const item = lines[i].trim().replace(ordered ? /^\d+\. / : /^- /, '')
        items.push(`<li>${inline(item)}</li>`)
        text.push(plain(item))
        i++
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }

    if (t.startsWith('>')) {
      const body: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        body.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const joined = body.join(' ')
      text.push(plain(joined))
      out.push(`<blockquote>${inline(joined)}</blockquote>`)
      continue
    }

    if (t.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      rows.flat().forEach((c) => text.push(plain(c)))
      out.push(
        `<div class="help-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      )
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |- |\d+\. |>|\||::)/.test(lines[i].trim())) {
      para.push(lines[i].trim())
      i++
    }
    const joined = para.join(' ')
    text.push(plain(joined))
    out.push(`<p>${inline(joined)}</p>`)
  }

  return { title, html: out.join('\n'), headings, text: text.join(' ') }
}
