'use client'

import { Fragment, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { capacity as capacityApi, clients as clientsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { isManagerial, type UserCapacity } from '@/lib/types'

const MONTH = 'YYYY-MM'

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function UsageBar({ used, allocated }: { used: number; allocated: number }) {
  if (allocated <= 0) return <div className="h-1.5 rounded-full bg-white/5" />
  const over = used > allocated
  const pct = Math.min((used / allocated) * 100, 100)
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${over ? 'bg-rose-400' : pct >= 85 ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Remaining({ hours, allocated }: { hours: number; allocated: number }) {
  if (allocated <= 0 && hours <= 0) return <span className="text-muted-foreground">—</span>
  return hours < 0
    ? <span className="text-rose-400">{fh(-hours)} over</span>
    : <span>{fh(hours)}</span>
}

// ── Edit allocations dialog ───────────────────────────────────────────────────

function EditAllocationsDialog({ row, month, onClose }: { row: UserCapacity; month: string; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const initial = Object.fromEntries(
    row.clients.filter((c) => c.clientId !== null && c.allocatedHours > 0).map((c) => [c.clientId!, String(c.allocatedHours)])
  ) as Record<number, string>
  const [hours, setHours] = useState<Record<number, string>>(initial)
  const [adding, setAdding] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })
  const clientName = (id: number) => clientList.find((c) => c.clientId === id)?.name ?? row.clients.find((c) => c.clientId === id)?.clientName ?? 'Client'
  const listed = Object.keys(hours).map(Number)
  const addable = clientList.filter((c) => c.isActive && !listed.includes(c.clientId))
  const total = Object.values(hours).reduce((s, v) => s + (Number(v) || 0), 0)

  async function save() {
    setError('')
    const changes = Object.entries(hours)
      .map(([id, v]) => ({ clientId: Number(id), monthlyHours: Number(v) || 0 }))
      .filter((c) => (Number(initial[c.clientId]) || 0) !== c.monthlyHours)
    if (changes.some((c) => c.monthlyHours < 0)) { setError('Hours can\'t be negative'); return }
    setSaving(true)
    try {
      await Promise.all(changes.map((c) => capacityApi.setAllocation(token!, { userId: row.userId, ...c, fromMonth: month })))
      toast.success(`Allocations saved for ${row.userName}`)
      queryClient.invalidateQueries({ queryKey: ['capacity'] })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{row.userName}&apos;s monthly hours</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Applies from {dayjs(`${month}-01`).format('MMMM YYYY')} onward. Earlier months keep their hours. Set a client to 0 to remove it.
          </p>
          <div className="space-y-2">
            {listed.length === 0 && <p className="text-sm text-muted-foreground">No clients allocated yet</p>}
            {listed.map((id) => (
              <div key={id} className="flex items-center gap-3">
                <span className="flex-1 text-sm truncate">{clientName(id)}</span>
                <Input
                  type="number" min={0} step={0.5} className="w-24 text-right"
                  value={hours[id]}
                  onChange={(e) => setHours((h) => ({ ...h, [id]: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground w-10">h / mo</span>
              </div>
            ))}
          </div>
          {addable.length > 0 && (
            <select
              value={adding}
              onChange={(e) => {
                const id = Number(e.target.value)
                if (id) setHours((h) => ({ ...h, [id]: '' }))
                setAdding('')
              }}
              className="w-full px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">+ Add a client…</option>
              {addable.map((c) => <option key={c.clientId} value={c.clientId}>{c.name}</option>)}
            </select>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono font-semibold">{fh(total)} / month</span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CapacityPage() {
  const { token, user } = useAuthStore()
  const [month, setMonth] = useState(dayjs().format(MONTH))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<UserCapacity | null>(null)
  const canManage = isManagerial(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['capacity', token, month],
    queryFn: () => capacityApi.get(token!, { month }),
    enabled: !!token && canManage,
  })

  if (!canManage) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access restricted to managers and admins</div>
  }

  const rows = data?.rows ?? []
  const totals = rows.reduce(
    (t, r) => ({ allocated: t.allocated + r.allocatedHours, used: t.used + r.usedHours, cover: t.cover + r.coverHours }),
    { allocated: 0, used: 0, cover: 0 }
  )
  const shift = (n: number) => setMonth(dayjs(`${month}-01`).add(n, 'month').format(MONTH))
  const isCurrent = month === dayjs().format(MONTH)

  function toggle(userId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Capacity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monthly hours allocated, used and remaining per team member</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Previous month">‹</Button>
          <span className="text-sm font-semibold w-32 text-center">{dayjs(`${month}-01`).format('MMMM YYYY')}</span>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Next month">›</Button>
          {!isCurrent && <Button variant="ghost" size="sm" onClick={() => setMonth(dayjs().format(MONTH))}>This month</Button>}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Allocated', value: fh(totals.allocated) },
          { label: 'Used', value: fh(totals.used) },
          { label: 'Remaining', value: totals.allocated - totals.used < 0 ? `${fh(totals.used - totals.allocated)} over` : fh(totals.allocated - totals.used) },
          { label: 'Holiday cover', value: fh(totals.cover), accent: totals.cover > 0 },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t.label}</p>
            <p className={`text-xl font-semibold mt-1 tabular-nums ${t.accent ? 'text-amber-400' : ''}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team member</TableHead>
              <TableHead className="w-40">Usage</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Holiday cover</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No team members yet</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const open = expanded.has(r.userId)
              return (
                <Fragment key={r.userId}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(r.userId)}>
                    <TableCell>
                      <span className="inline-block w-4 text-muted-foreground">{open ? '▾' : '▸'}</span>
                      <span className="text-sm font-medium">{r.userName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {r.clients.length} client{r.clients.length === 1 ? '' : 's'}
                      </span>
                    </TableCell>
                    <TableCell><UsageBar used={r.usedHours} allocated={r.allocatedHours} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.allocatedHours > 0 ? fh(r.allocatedHours) : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fh(r.usedHours)}</TableCell>
                    <TableCell className="text-right font-mono text-sm"><Remaining hours={r.remainingHours} allocated={r.allocatedHours} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.coverHours > 0 ? <span className="text-amber-400">{fh(r.coverHours)}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                    </TableCell>
                  </TableRow>
                  {open && r.clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="pl-10 text-xs text-muted-foreground">
                        No clients or time this month —{' '}
                        <button className="text-primary hover:underline" onClick={() => setEditing(r)}>allocate hours</button>
                      </TableCell>
                    </TableRow>
                  )}
                  {open && r.clients.map((c) => {
                    const remaining = c.allocatedHours - c.usedHours
                    return (
                      <TableRow key={`${r.userId}-${c.clientId ?? 'none'}`} className="bg-white/[0.02]">
                        <TableCell className="pl-10 text-sm text-muted-foreground">
                          {c.clientName}
                          {c.coverHours > 0 && c.allocatedHours === 0 && c.usedHours === 0 && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">Cover</span>
                          )}
                        </TableCell>
                        <TableCell><UsageBar used={c.usedHours} allocated={c.allocatedHours} /></TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{c.allocatedHours > 0 ? fh(c.allocatedHours) : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{fh(c.usedHours)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground"><Remaining hours={remaining} allocated={c.allocatedHours} /></TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {c.coverHours > 0 ? <span className="text-amber-400">{fh(c.coverHours)}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )
                  })}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Used is time logged in the month against the member&apos;s own clients. Holiday cover is tracked separately and doesn&apos;t use up their allocation.
      </p>

      {editing && <EditAllocationsDialog row={editing} month={month} onClose={() => setEditing(null)} />}
    </div>
  )
}
