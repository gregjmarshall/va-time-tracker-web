'use client'

import { PipMark, PipWordmark } from '@/components/brand/PipLogo'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ApiError, auth } from '@/lib/api'
import { useCompleteLogin } from '@/lib/session'
import type { WorkspaceChoice } from '@/lib/types'

export default function LoginPage() {
  const completeLogin = useCompleteLogin()
  const [choices, setChoices] = useState<WorkspaceChoice[] | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await auth.login(email, password)
      await completeLogin(res.token)
    } catch (err) {
      // Same email + password in several agencies: let them pick one
      const workspaces = err instanceof ApiError && err.status === 409
        ? (err.body as { workspaces?: WorkspaceChoice[] }).workspaces
        : undefined
      if (workspaces?.length) setChoices(workspaces)
      else toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function chooseWorkspace(workspaceId: number) {
    setLoading(true)
    try {
      const res = await auth.loginWorkspace(workspaceId, email, password)
      await completeLogin(res.token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(ellipse, rgba(124,92,246,0.18) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center gap-3 mb-3">
            <PipMark size={56} className="shadow-xl shadow-primary/30 rounded-[16px]" />
            <PipWordmark height={30} className="text-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your workspace
          </p>
        </div>

        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            {choices ? (
              <div className="space-y-3">
                <p className="text-sm">Your account is in more than one agency. Which one?</p>
                {choices.map((w) => (
                  <Button key={w.workspaceId} variant="outline" className="w-full justify-start" disabled={loading} onClick={() => chooseWorkspace(w.workspaceId)}>
                    {w.name}
                    <span className="ml-auto text-xs text-muted-foreground font-normal">{w.slug}</span>
                  </Button>
                ))}
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setChoices(null)}>← Back</button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="text-right -mt-1">
                <a
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            )}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              New agency? <a href="/signup" className="text-primary hover:underline">Start a free trial</a>
              <br />
              Joining a team? Ask your Admin or Manager for an invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
