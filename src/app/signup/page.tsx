'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/AuthShell'
import { auth } from '@/lib/api'
import { useCompleteLogin } from '@/lib/session'

/** Public self-serve sign-up: creates the agency on a free trial and its Admin, then opens the setup wizard. */
export default function SignupPage() {
  const completeLogin = useCompleteLogin()
  const [agencyName, setAgencyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [emailInUse, setEmailInUse] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setEmailInUse(false)
    try {
      const res = await auth.signup({ agencyName, name, email, password, website: website || undefined })
      if (res.verificationRequired || !res.auth) {
        setCheckEmail(true)
        return
      }
      await completeLogin(res.auth.token, '/welcome')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed'
      // The account already exists: point to sign-in rather than a dead-end error
      if (message.includes('already has a pip account')) setEmailInUse(true)
      else toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <AuthShell subtitle="Almost there">
        <p className="text-sm">We&apos;ve sent a link to <strong>{email}</strong>. Click it to verify your email, then sign in.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      subtitle="Start your 30-day free trial — no card needed"
      footer={<>Already using pip? <Link href="/login" className="text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {emailInUse && (
          <div role="alert" className="rounded-md border border-primary/30 bg-primary/[0.06] px-3.5 py-3 text-sm">
            <strong>{email}</strong> already has a pip account.{' '}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link> or{' '}
            <Link href="/forgot-password" className="text-primary hover:underline">reset your password</Link>.
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="agencyName">Agency name</Label>
          <Input id="agencyName" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Bright Side VAs" required maxLength={100} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jo Bloggs" required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
        </div>
        {/* Honeypot: hidden from people, bots fill it in */}
        <div aria-hidden className="absolute -left-[10000px] w-px h-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating your agency…' : 'Create agency'}
        </Button>
        <p className="text-xs text-muted-foreground text-center">You&apos;ll be the Admin and can invite your team next.</p>
      </form>
    </AuthShell>
  )
}
