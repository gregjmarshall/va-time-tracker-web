'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { coverDates } from '@/components/dashboard/MyCoverAndCapacity'
import { clients as clientsApi, holidayCover, users as usersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { isManagerial, type CoverStatus, type HolidayCoverResponse, type UserResponse } from '@/lib/types'

const DATE = 'YYYY-MM-DD'

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function displayName(u: UserResponse) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
}

// ── End date picker (quick options + custom) ──────────────────────────────────

type EndChoice = 'week' | 'month' | 'custom' | 'none'

function resolveEnd(choice: EndChoice, custom: string, start: string): string | undefined {
  const base = dayjs(start).isAfter(dayjs()) ? dayjs(start) : dayjs()
  switch (choice) {
    case 'week': return base.endOf('week').format(DATE)
    case 'month': return base.endOf('month').format(DATE)
    case 'custom': return custom || undefined
    case 'none': return undefined
  }
}

function EndDatePicker({ start, choice, custom, onChoice, onCustom }: {
  start: string; choice: EndChoice; custom: string
  onChoice: (c: EndChoice) => void; onCustom: (d: string) => void
}) {
  const options: { key: EndChoice; label: string }[] = [
    { key: 'week', label: 'End of week' },
    { key: 'month', label: 'End of month' },
    { key: 'custom', label: 'Pick a date' },
    { key: 'none', label: 'No end date' },
  ]
  const resolved = resolveEnd(choice, custom, start)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChoice(o.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              choice === o.key
                ? 'bg-primary text-white border-primary'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === 'custom' && (
        <Input type="date" value={custom} min={start} onChange={(e) => onCustom(e.target.value)} />
      )}
      <p className="text-xs text-muted-foreground">
        {resolved
          ? `Cover ends automatically after ${dayjs(resolved).format('ddd D MMM YYYY')}.`
          : 'Cover stays on until you end it here.'}
      </p>
    </div>
  )
}

// ── Add cover dialog ──────────────────────────────────────────────────────────

function AddCoverDialog({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<number | null>(null)
  const [clientIds, setClientIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [start, setStart] = useState(dayjs().format(DATE))
  const [endChoice, setEndChoice] = useState<EndChoice>('month')
  const [customEnd, setCustomEnd] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const { data: people = [] } = useQuery({
    queryKey: ['users', token],
    queryFn: () => usersApi.list(token!),
    enabled: !!token,
  })
  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })

  // Team members first, then managers/admins
  const candidates = people
    .filter((u) => u.isActive)
    .sort((a, b) => Number(a.role !== 'TEAM_MEMBER') - Number(b.role !== 'TEAM_MEMBER') || displayName(a).localeCompare(displayName(b)))
  const q = search.trim().toLowerCase()
  const visibleClients = clientList.filter((c) => c.isActive && (!q || c.name.toLowerCase().includes(q)))

  const createMutation = useMutation({
    mutationFn: () => holidayCover.create(token!, {
      userId: userId!,
      clientIds: [...clientIds],
      startDate: start,
      endDate: resolveEnd(endChoice, customEnd, start),
      note: note.trim() || undefined,
    }),
    onSuccess: (created) => {
      toast.success(`Holiday cover added for ${created.length} client${created.length === 1 ? '' : 's'}`)
      queryClient.invalidateQueries({ queryKey: ['holiday-cover'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  function toggle(clientId: number) {
    setClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!userId) { setError('Choose who is covering'); return }
    if (clientIds.size === 0) { setError('Choose at least one client'); return }
    if (endChoice === 'custom' && !customEnd) { setError('Pick an end date'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add holiday cover</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cover-user">Who&apos;s covering?</Label>
            <select
              id="cover-user"
              value={userId ?? ''}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a person…</option>
              {candidates.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {displayName(u)}{u.role !== 'TEAM_MEMBER' ? ` (${u.role === 'ADMIN' ? 'Admin' : 'Manager'})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Clients to cover</Label>
              {clientIds.size > 0 && <span className="text-xs text-muted-foreground">{clientIds.size} selected</span>}
            </div>
            <Input placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {visibleClients.length === 0 && <p className="text-sm text-muted-foreground p-3">No clients found</p>}
              {visibleClients.map((c) => (
                <label key={c.clientId} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-white/5">
                  <input type="checkbox" checked={clientIds.has(c.clientId)} onChange={() => toggle(c.clientId)} className="accent-primary" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover-start">Starts</Label>
            <Input id="cover-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Ends</Label>
            <EndDatePicker start={start} choice={endChoice} custom={customEnd} onChoice={setEndChoice} onCustom={setCustomEnd} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover-note">Note (optional)</Label>
            <Input id="cover-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Covering while Sarah is on holiday" maxLength={500} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add cover'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Change end date dialog ────────────────────────────────────────────────────

function ChangeEndDialog({ cover, onClose }: { cover: HolidayCoverResponse; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<EndChoice>(cover.endDate ? 'custom' : 'none')
  const [custom, setCustom] = useState(cover.endDate ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const end = resolveEnd(choice, custom, cover.startDate)
      return holidayCover.update(token!, cover.coverId, end ? { endDate: end } : { clearEndDate: true })
    },
    onSuccess: () => {
      toast.success('Cover updated')
      queryClient.invalidateQueries({ queryKey: ['holiday-cover'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Change end date</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {cover.userName} covering <span className="text-foreground font-medium">{cover.clientName}</span> from {dayjs(cover.startDate).format('D MMM YYYY')}
          </p>
          <EndDatePicker start={cover.startDate} choice={choice} custom={custom} onChoice={setChoice} onCustom={setCustom} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || (choice === 'custom' && !custom)}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteCoverDialog({ cover, onClose }: { cover: HolidayCoverResponse; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => holidayCover.delete(token!, cover.coverId),
    onSuccess: () => {
      toast.success('Cover deleted')
      queryClient.invalidateQueries({ queryKey: ['holiday-cover'] })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete this cover?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          {cover.userName}&apos;s time on {cover.clientName}
          {cover.hoursLogged > 0 ? ` (${fh(cover.hoursLogged)} so far)` : ''} will no longer be reported as holiday cover.
          To stop the cover but keep that history, use <span className="text-foreground font-medium">End today</span> instead.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Keep it</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Deleting…' : 'Delete cover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<CoverStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'border-amber-400/40 text-amber-400' },
  UPCOMING: { label: 'Upcoming', className: 'border-sky-400/40 text-sky-400' },
  ENDED: { label: 'Ended', className: 'text-muted-foreground' },
}

export default function HolidayCoverPage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'current' | 'past'>('current')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<HolidayCoverResponse | null>(null)
  const [deleting, setDeleting] = useState<HolidayCoverResponse | null>(null)
  const canManage = isManagerial(user?.role)

  const { data: covers = [], isLoading } = useQuery({
    queryKey: ['holiday-cover', token],
    queryFn: () => holidayCover.list(token!),
    enabled: !!token && canManage,
  })

  const endMutation = useMutation({
    mutationFn: (cover: HolidayCoverResponse) => holidayCover.end(token!, cover.coverId),
    onSuccess: (_, cover) => {
      toast.success(cover.status === 'UPCOMING' ? 'Upcoming cover cancelled' : `Cover ends today for ${cover.userName}`)
      queryClient.invalidateQueries({ queryKey: ['holiday-cover'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!canManage) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access restricted to managers and admins</div>
  }

  const current = covers
    .filter((c) => c.status !== 'ENDED')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = covers.filter((c) => c.status === 'ENDED')
  const shown = tab === 'current' ? current : past
  const activeCount = current.filter((c) => c.status === 'ACTIVE').length
  const activeHours = current.filter((c) => c.status === 'ACTIVE').reduce((s, c) => s + c.hoursLogged, 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Holiday cover</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount > 0
              ? `${activeCount} active cover${activeCount === 1 ? '' : 's'} · ${fh(activeHours)} logged so far`
              : 'Who is covering which clients, and until when'}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add cover</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'current' | 'past')}>
        <TabsList className="mb-4">
          <TabsTrigger value="current">Current &amp; upcoming{current.length > 0 ? ` (${current.length})` : ''}</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Covering</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Hours logged</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            )}
            {!isLoading && shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {tab === 'current' ? (
                    <>No holiday cover set up —{' '}
                      <button className="text-primary hover:underline" onClick={() => setAddOpen(true)}>add some</button>
                    </>
                  ) : 'No past cover yet'}
                </TableCell>
              </TableRow>
            )}
            {shown.map((c) => (
              <TableRow key={c.coverId}>
                <TableCell>
                  <p className="text-sm font-medium">{c.userName}</p>
                  {c.note && <p className="text-xs text-muted-foreground truncate max-w-[16rem]">{c.note}</p>}
                </TableCell>
                <TableCell className="text-sm">{c.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{coverDates(c.startDate, c.endDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[c.status].className}`}>{STATUS_BADGE[c.status].label}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fh(c.hoursLogged)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2">
                      •••
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.status !== 'ENDED' && (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => endMutation.mutate(c)}>
                          {c.status === 'UPCOMING' ? 'Cancel cover' : 'End today'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setEditing(c)}>Change end date…</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => setDeleting(c)}>Delete…</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        While a cover is active, the person covering can see the client and log time to its projects. That time shows as
        holiday cover in Reports and Capacity, so it can be billed separately. It still counts towards the client&apos;s totals.
      </p>

      {addOpen && <AddCoverDialog onClose={() => setAddOpen(false)} />}
      {editing && <ChangeEndDialog cover={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteCoverDialog cover={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
