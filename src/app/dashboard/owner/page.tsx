'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invitations } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { CopyLink, inviteUrl } from '@/components/team/CopyLink'
import type { Invitation } from '@/lib/types'

const STATE_LABEL: Record<Invitation['state'], string> = { OPEN: 'Open', USED: 'Accepted', EXPIRED: 'Expired', REVOKED: 'Cancelled' }

/** Platform owner console (wave 1: agency invites only; orgs/MRR/billing come in wave 2). */
export default function OwnerPage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [created, setCreated] = useState<{ url: string; email: string; emailSent: boolean } | null>(null)

  const { data: list = [] } = useQuery({
    queryKey: ['invitations', 'ORG', token],
    queryFn: () => invitations.list(token!, 'ORG'),
    enabled: !!token && !!user?.isOwner,
  })

  const create = useMutation({
    mutationFn: () => invitations.create(token!, { kind: 'ORG', email, agencyName: agencyName || undefined }),
    onSuccess: (res) => {
      setCreated({ url: inviteUrl(res.token), email: res.invitation.email, emailSent: res.emailSent })
      setEmail('')
      setAgencyName('')
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const revoke = useMutation({
    mutationFn: (inv: Invitation) => invitations.revoke(token!, inv.invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
    onError: (err: Error) => toast.error(err.message),
  })

  if (!user?.isOwner) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Platform owners only</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-normal">Owner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Invite new agencies. Each starts a free trial with the invitee as its Admin.</p>
      </div>

      <section className="rounded-lg glass-card p-5 space-y-4">
        <h2 className="font-medium">Invite an agency</h2>
        <form onSubmit={(e) => { e.preventDefault(); setCreated(null); create.mutate() }} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="org-email">Admin&apos;s email</Label>
            <Input id="org-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="founder@agency.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Agency name (optional)</Label>
            <Input id="org-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={100} placeholder="They can change it" />
          </div>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create link'}</Button>
        </form>
        {created && (
          <div className="space-y-2">
            <p className="text-sm">Link for <strong>{created.email}</strong> (works once, shown only now):</p>
            <CopyLink url={created.url} />
            <p className="text-xs text-muted-foreground">{created.emailSent ? 'Also emailed.' : "Couldn't email it — send the link yourself."}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agency invites <span className="num font-normal">({list.length})</span></h2>
        <div className="rounded-lg glass-card divide-y divide-white/5">
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">None yet.</p>}
          {list.map((inv) => (
            <div key={inv.invitationId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{inv.agencyName ?? '—'} <span className="text-muted-foreground font-normal">· {inv.email}</span></p>
                <p className="text-xs text-muted-foreground">Created {dayjs(inv.createdAt).format('D MMM')} · expires {dayjs(inv.expiresAt).format('D MMM')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={inv.state === 'OPEN' ? 'secondary' : 'outline'} className="text-xs">{STATE_LABEL[inv.state]}</Badge>
                {inv.state === 'OPEN' && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => revoke.mutate(inv)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
