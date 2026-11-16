'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { auth, users } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { ROLES, roleLabel, type Role, type UserResponse } from '@/lib/types'
import { memberName } from './member'

const SELECT_CLASS = 'w-full px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer'

/** Refreshes every list of users after a change. */
export function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['users-all'] })
    queryClient.invalidateQueries({ queryKey: ['member-history'] })
  }
}

/** Deactivate or reactivate an account, with the backend's refusal shown as a toast. */
export function useToggleActive() {
  const { token } = useAuthStore()
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (u: UserResponse) => users.update(token!, u.userId, { isActive: !u.isActive }),
    onSuccess: (u) => {
      invalidate()
      toast.success(`${memberName(u)} ${u.isActive ? 'reactivated' : 'deactivated'}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Name and (for Admins) role. Managers can only rename Team Members. */
export function EditMemberDialog({ member, onClose }: { member: UserResponse; onClose: () => void }) {
  const { token, user: currentUser } = useAuthStore()
  const invalidate = useInvalidateUsers()
  const [firstName, setFirstName] = useState(member.firstName ?? '')
  const [lastName, setLastName] = useState(member.lastName ?? '')
  const [role, setRole] = useState<Role>(member.role)
  const canChangeRole = currentUser?.role === 'ADMIN' && currentUser.userId !== member.userId

  const save = useMutation({
    mutationFn: () =>
      users.update(token!, member.userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(canChangeRole && role !== member.role ? { role } : {}),
      }),
    onSuccess: (u) => {
      invalidate()
      toast.success(`Saved ${memberName(u)}`)
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit {memberName(member)}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">First name</Label>
              <Input id="edit-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">Last name</Label>
              <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
          {canChangeRole && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <select id="edit-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={SELECT_CLASS}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddUserDialog({ role, onClose, onCreated }: { role: Role; onClose: () => void; onCreated: (email: string) => void }) {
  const { token, user: currentUser } = useAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const label = roleLabel(role).toLowerCase()

  const createMutation = useMutation({
    mutationFn: () =>
      auth.register(token!, {
        workspaceId: currentUser!.workspaceId,
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role,
      }),
    onSuccess: () => {
      toast.success(`${roleLabel(role)} account created for ${email}`)
      onCreated(email)
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Add {label}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
            <p className="text-xs text-muted-foreground">Share this with the {label}. They can change it later.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : `Create ${label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
