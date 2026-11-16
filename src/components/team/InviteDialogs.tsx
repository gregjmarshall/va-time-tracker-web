'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { invitations } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { isAdmin, roleLabel, type Invitation, type Role } from '@/lib/types'
import { CopyLink, inviteUrl } from './CopyLink'

/**
 * Add person = invite link (copyable; we also try to email it). The old temporary-password flow is the
 * fallback, via [onUsePassword].
 */
export function InviteDialog({ role, onClose, onUsePassword }: { role: Role; onClose: () => void; onUsePassword: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ url: string; emailSent: boolean; email: string } | null>(null)
  const label = roleLabel(role).toLowerCase()

  const create = useMutation({
    mutationFn: () => invitations.create(token!, { kind: 'MEMBER', email, role }),
    onSuccess: (res) => {
      setCreated({ url: inviteUrl(res.token), emailSent: res.emailSent, email: res.invitation.email })
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Invite {label}</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-4 py-2">
            <p className="text-sm">Send this link to <strong>{created.email}</strong>. It works once and expires in 7 days.</p>
            <CopyLink url={created.url} />
            <p className="text-xs text-muted-foreground">
              {created.emailSent ? 'We also emailed it to them.' : "We couldn't email it, so copy the link and send it yourself."}
              {' '}You won&apos;t be able to see this link again.
            </p>
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate() }} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required autoFocus />
              <p className="text-xs text-muted-foreground">They&apos;ll set their own name and password from the link.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" onClick={onUsePassword}>
                Set a temporary password instead
              </button>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create invite link'}</Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Open (not yet accepted) invites, with Cancel. */
export function PendingInvites() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: ['invitations', token],
    queryFn: () => invitations.list(token!, 'MEMBER'),
    enabled: !!token,
  })
  const revoke = useMutation({
    mutationFn: (inv: Invitation) => invitations.revoke(token!, inv.invitationId),
    onSuccess: (_, inv) => {
      toast.success(`Cancelled the invite for ${inv.email}`)
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const open = data.filter((i) => i.state === 'OPEN')
  if (open.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Pending invites <span className="num font-normal">({open.length})</span>
      </h2>
      <div className="rounded-2xl glass-card divide-y divide-white/5">
        {open.map((inv) => {
          const canCancel = isAdmin(user?.role) || inv.role === 'TEAM_MEMBER'
          return (
            <div key={inv.invitationId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{inv.email}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(inv.role)} · expires {dayjs(inv.expiresAt).format('D MMM')}</p>
              </div>
              {canCancel && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(inv)}>
                  Cancel invite
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
