'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { retainers } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ClientResponse, ProjectResponse, RetainerResponse } from '@/lib/types'

const selectClass = 'w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-primary/50 [&>option]:bg-[#151737]'

/** "YYYY-MM" for 24 months back to 12 ahead, newest last. */
function monthOptions() {
  const start = dayjs().startOf('month').subtract(24, 'month')
  return Array.from({ length: 37 }, (_, i) => start.add(i, 'month').format('YYYY-MM'))
}
const monthLabel = (date: string) => dayjs(date).format('MMM YYYY')
const hoursLabel = (h: number) => `${Number(h)}h`

/** Retainer in effect this month for a scope (null projectId = client-wide). */
function currentFor(rows: RetainerResponse[], projectId: number | null) {
  const today = dayjs().format('YYYY-MM-DD')
  return rows.find((r) => (r.projectId ?? null) === projectId && r.effectiveFrom <= today && (!r.effectiveTo || r.effectiveTo >= today))
}

/**
 * Sets, changes and ends a client's retainers: one client-wide and/or one per project. Changes take
 * effect from the 1st of a month, and each client/project keeps its history of changes.
 */
export function RetainerDialog({ client, projects, onClose }: {
  client: ClientResponse | null
  projects: ProjectResponse[]
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const clientId = client?.clientId

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['retainers', token, clientId],
    queryFn: () => retainers.list(token!, clientId),
    enabled: !!token && !!clientId,
  })

  const clientProjects = projects.filter((p) => p.clientId === clientId)
  const projectName = new Map(clientProjects.map((p) => [p.projectId, p.name]))
  const scopeName = (projectId: number | null) => (projectId === null ? 'Client-wide' : projectName.get(projectId) ?? 'Project')

  const [scope, setScope] = useState<number | null>(null)
  const [hours, setHours] = useState('')
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const current = currentFor(rows, scope)

  function pickScope(projectId: number | null) {
    setScope(projectId)
    const c = currentFor(rows, projectId)
    setHours(c ? String(Number(c.monthlyHours)) : '')
  }

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['retainers'] }),
    queryClient.invalidateQueries({ queryKey: ['clients-with-retainer'] }),
    queryClient.invalidateQueries({ queryKey: ['reports-retainer'] }),
  ])

  const setMutation = useMutation({
    mutationFn: () => retainers.set(token!, { clientId: clientId!, projectId: scope, monthlyHours: Number(hours), effectiveFrom: month }),
    onSuccess: async () => {
      await refresh()
      toast.success(`${scopeName(scope)} retainer set to ${hours}h from ${monthLabel(month)}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const endMutation = useMutation({
    mutationFn: () => retainers.end(token!, { clientId: clientId!, projectId: scope, effectiveFrom: month }),
    onSuccess: async () => {
      await refresh()
      setHours('')
      toast.success(`${scopeName(scope)} is ad hoc from ${monthLabel(month)}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Scopes that have (or had) a retainer, client-wide first
  const scopes = [...new Set(rows.map((r) => r.projectId ?? null))]
    .sort((a, b) => (a === null ? -1 : b === null ? 1 : scopeName(a).localeCompare(scopeName(b))))
  // Only offer to end a retainer that is still in effect from the chosen month
  const canEnd = rows.some((r) => (r.projectId ?? null) === scope && (!r.effectiveTo || r.effectiveTo >= `${month}-01`))
  const pending = setMutation.isPending || endMutation.isPending

  return (
    <Dialog open={client !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Retainers · {client?.name}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Applies to</Label>
            <select className={selectClass} value={scope ?? ''} onChange={(e) => pickScope(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Whole client</option>
              {clientProjects.filter((p) => p.isActive || rows.some((r) => r.projectId === p.projectId)).map((p) => (
                <option key={p.projectId} value={p.projectId}>Project: {p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {scope === null
                ? 'Covers all hours on this client, except projects with their own retainer.'
                : 'Its own allowance: hours on this project count here, not towards the client-wide retainer.'}
              {' '}Now: {current ? `${hoursLabel(current.monthlyHours)} / month` : 'ad hoc'}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monthly hours</Label>
              <Input type="number" min="0.5" step="0.5" placeholder={current ? String(Number(current.monthlyHours)) : 'e.g. 60'} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <select className={selectClass} value={month} onChange={(e) => setMonth(e.target.value)}>
                {monthOptions().map((m) => <option key={m} value={m}>{monthLabel(`${m}-01`)}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {canEnd && (
              <Button variant="outline" disabled={pending} onClick={() => endMutation.mutate()}>
                {endMutation.isPending ? 'Saving…' : 'Switch to ad hoc'}
              </Button>
            )}
            <Button disabled={!(Number(hours) > 0) || pending} onClick={() => setMutation.mutate()}>
              {setMutation.isPending ? 'Saving…' : current ? 'Change retainer' : 'Set retainer'}
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-2">History</h3>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : scopes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No retainers yet. This client is ad hoc.</p>
            ) : (
              <div className="space-y-3">
                {scopes.map((s) => {
                  const periods = rows.filter((r) => (r.projectId ?? null) === s).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
                  return (
                    <div key={s ?? 'client'}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{scopeName(s)}</p>
                      <ul className="text-sm space-y-0.5">
                        {periods.map((r, i) => {
                          const prev = periods[i - 1]
                          const afterGap = prev?.effectiveTo && dayjs(prev.effectiveTo).add(1, 'day').format('YYYY-MM-DD') !== r.effectiveFrom
                          return (
                            <li key={r.retainerId}>
                              {prev && !afterGap
                                ? <>{hoursLabel(prev.monthlyHours)} → <span className="font-semibold">{hoursLabel(r.monthlyHours)}</span> from {monthLabel(r.effectiveFrom)}</>
                                : <><span className="font-semibold">{hoursLabel(r.monthlyHours)}</span> / month from {monthLabel(r.effectiveFrom)}</>}
                              {r.effectiveTo && (!periods[i + 1] || dayjs(r.effectiveTo).add(1, 'day').format('YYYY-MM-DD') !== periods[i + 1].effectiveFrom) && (
                                <span className="text-muted-foreground"> · ad hoc from {monthLabel(dayjs(r.effectiveTo).add(1, 'day').format('YYYY-MM-DD'))}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
