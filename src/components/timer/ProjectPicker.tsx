'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClientResponse, ProjectResponse } from '@/lib/types'

const Chevron = ({ dir }: { dir: 'right' | 'left' | 'down' }) => (
  <svg className={dir === 'left' ? 'w-3 h-3' : 'w-4 h-4 text-muted-foreground/30'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={dir === 'left' ? 3 : 2.5}>
    <path d={dir === 'right' ? 'M9 5l7 7-7 7' : dir === 'left' ? 'M15 19l-7-7 7-7' : 'M19 9l-7 7-7-7'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const rowClass = 'w-full text-left px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0 transition-colors disabled:opacity-50'

/**
 * Client → project chooser. With no search it drills down from client to project. Typing searches
 * client and project names at once and lists matching projects directly ("Client · Project"), so an
 * entry is always assigned to a project under its client.
 */
export function ProjectSearchList({ clientList, projectList, onSelect, disabled, autoFocus = true }: {
  clientList: ClientResponse[]
  projectList: ProjectResponse[]
  onSelect: (projectId: number) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [clientId, setClientId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const clientName = new Map(clientList.map((c) => [c.clientId, c.name]))
  const activeProjects = projectList.filter((p) => p.isActive && clientName.has(p.clientId))
  const clientsWithProjects = clientList
    .filter((c) => activeProjects.some((p) => p.clientId === c.clientId))
    .sort((a, b) => a.name.localeCompare(b.name))

  const matches = q
    ? activeProjects
        .filter((p) => (clientId === null || p.clientId === clientId) &&
          (p.name.toLowerCase().includes(q) || clientName.get(p.clientId)!.toLowerCase().includes(q)))
        .sort((a, b) => `${clientName.get(a.clientId)} ${a.name}`.localeCompare(`${clientName.get(b.clientId)} ${b.name}`))
    : []

  return (
    <>
      <div className="p-3 border-b border-white/5">
        <input autoFocus={autoFocus}
          placeholder={clientId ? 'Search projects…' : 'Search clients or projects…'}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
        />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {clientId !== null && (
          <button type="button"
            className="w-full text-left px-4 py-2.5 text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest hover:bg-white/5 flex items-center gap-2 border-b border-white/5 transition-colors"
            onClick={() => { setClientId(null); setSearch('') }}>
            <Chevron dir="left" />
            {clientName.get(clientId)}
          </button>
        )}
        {q ? (
          matches.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">No matching projects</p>
            : matches.map((p) => (
              <button key={p.projectId} type="button" disabled={disabled} className={rowClass} onClick={() => onSelect(p.projectId)}>
                {clientId === null && <span className="text-muted-foreground font-medium">{clientName.get(p.clientId)} · </span>}
                {p.name}
              </button>
            ))
        ) : clientId === null ? (
          clientsWithProjects.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">No projects assigned to you yet</p>
            : clientsWithProjects.map((c) => (
              <button key={c.clientId} type="button" className={`${rowClass} flex items-center justify-between`}
                onClick={() => setClientId(c.clientId)}>
                {c.name}
                <Chevron dir="right" />
              </button>
            ))
        ) : (
          activeProjects.filter((p) => p.clientId === clientId).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <button key={p.projectId} type="button" disabled={disabled} className={rowClass} onClick={() => onSelect(p.projectId)}>
              {p.name}
            </button>
          ))
        )}
      </div>
    </>
  )
}

/** Dropdown button showing the chosen "Client · Project", opening a [ProjectSearchList]. */
export function ProjectPicker({ clientList, projectList, selectedProjectId, onSelect, placeholder = 'Select project' }: {
  clientList: ClientResponse[]
  projectList: ProjectResponse[]
  selectedProjectId: number | null
  onSelect: (projectId: number | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedProject = projectList.find((p) => p.projectId === selectedProjectId)
  const selectedClient = selectedProject ? clientList.find((c) => c.clientId === selectedProject.clientId) : null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/8 transition-all w-full text-left"
      >
        <svg className="w-4 h-4 flex-shrink-0 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`flex-1 truncate ${selectedProject ? 'text-white' : ''}`}>
          {selectedProject ? `${selectedClient?.name} · ${selectedProject.name}` : placeholder}
        </span>
        {selectedProjectId ? (
          <span role="button" aria-label="Clear project" className="text-muted-foreground/40 hover:text-white text-xs px-1"
            onMouseDown={(e) => { e.stopPropagation(); onSelect(null) }}>✕</span>
        ) : (
          <Chevron dir="down" />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-[#151737]/98 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden">
          <ProjectSearchList
            clientList={clientList}
            projectList={projectList}
            onSelect={(id) => { onSelect(id); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}
