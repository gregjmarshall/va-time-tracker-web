'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchItem { href: string; title: string; section: string; text: string }

/** Client-side search over page titles and headings (titles first), then page text. */
function search(items: SearchItem[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored = items.map((item) => {
    const title = item.title.toLowerCase()
    const text = item.text.toLowerCase()
    let score = 0
    for (const w of words) {
      if (title.startsWith(w)) score += 6
      else if (title.includes(w)) score += 4
      else if (text.includes(w)) score += 1
      else return { item, score: 0 }
    }
    return { item, score: score + (item.href.includes('#') ? 0 : 1) }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map((s) => s.item)
}

export function HelpSearch({ items }: { items: SearchItem[] }) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = search(items, query)

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    router.push(href)
  }

  return (
    <div className="relative w-full max-w-md">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search help…"
        aria-label="Search help"
        role="combobox"
        aria-expanded={open && query.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && results[active]) go(results[active].href)
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
        }}
        className="w-full h-10 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 sm:right-auto sm:w-full top-12 z-40 rounded-lg border border-white/10 bg-[#1a1d3d] p-1 shadow-xl max-h-[70vh] overflow-y-auto min-w-[16rem]">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No results for “{query}”</li>}
          {results.map((r, i) => (
            <li key={r.href} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(r.href) }}
                onMouseEnter={() => setActive(i)}
                className={cn('w-full text-left rounded-lg px-3 py-2', i === active ? 'bg-white/10' : '')}
              >
                <span className="block text-sm font-medium text-foreground">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.section}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
