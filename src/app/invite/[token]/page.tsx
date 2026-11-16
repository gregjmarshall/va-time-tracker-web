'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/AuthShell'
import { invitations } from '@/lib/api'
import { useCompleteLogin } from '@/lib/session'
import { roleLabel } from '@/lib/types'

const CLOSED: Record<string, string> = {
  USED: 'This invite has already been used.',
  EXPIRED: 'This invite has expired. Ask whoever invited you for a new link.',
  REVOKED: 'This invite was cancelled. Ask whoever invited you for a new link.',
}

/** Accept an invite link: set name and password, then you're signed in. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const completeLogin = useCompleteLogin()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => invitations.lookup(token),
    retry: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await invitations.accept({
        token, name, password,
        agencyName: invite?.kind === 'ORG' ? (agencyName ?? invite.agencyName ?? '') : undefined,
      })
      await completeLogin(res.token, invite?.kind === 'ORG' ? '/welcome' : '/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept the invite')
    } finally {
      setLoading(false)
    }
  }

  const signIn = <>Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link></>

  if (isLoading) return <AuthShell subtitle="Checking your invite…"><p className="text-sm text-muted-foreground">Loading…</p></AuthShell>
  if (error || !invite) {
    return <AuthShell subtitle="Invite not found" footer={signIn}><p className="text-sm">This invite link isn&apos;t valid. Check you copied all of it.</p></AuthShell>
  }
  if (invite.state !== 'OPEN') {
    return <AuthShell subtitle="Invite unavailable" footer={signIn}><p className="text-sm">{CLOSED[invite.state]}</p></AuthShell>
  }

  const subtitle = invite.kind === 'ORG'
    ? 'Set up your agency on pip — 30-day free trial'
    : `Join ${invite.workspaceName ?? 'your team'} on pip as ${roleLabel(invite.role)}`

  return (
    <AuthShell subtitle={subtitle} footer={signIn}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {invite.invitedBy && <p className="text-sm text-muted-foreground">{invite.invitedBy} invited you.</p>}
        <div className="space-y-1.5">
          <Label>Email</Label>
          <p className="text-sm">{invite.email}</p>
        </div>
        {invite.kind === 'ORG' && (
          <div className="space-y-1.5">
            <Label htmlFor="agencyName">Agency name</Label>
            <Input id="agencyName" value={agencyName ?? invite.agencyName ?? ''} onChange={(e) => setAgencyName(e.target.value)} required maxLength={100} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jo Bloggs" required autoFocus autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Choose a password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Setting up…' : invite.kind === 'ORG' ? 'Create agency' : 'Accept invite'}
        </Button>
      </form>
    </AuthShell>
  )
}
