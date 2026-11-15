'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MoreHorizontalIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { users } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { isAdmin, isManagerial, roleLabel, type Role, type UserResponse } from '@/lib/types'
import { AccessDialog } from '@/components/team/AccessDialog'
import { AddUserDialog, EditMemberDialog, useInvalidateUsers, useToggleActive } from '@/components/team/MemberDialogs'
import { canManage, memberInitials, memberName } from '@/components/team/member'

dayjs.extend(relativeTime)

function lastTrackedLabel(u: UserResponse) {
  return u.lastTrackedAt ? dayjs(u.lastTrackedAt).fromNow() : 'Never'
}

function MemberCell({ u }: { u: UserResponse }) {
  return (
    <Link href={`/dashboard/users/${u.userId}`} className="flex items-center gap-3 min-w-0 group">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{memberInitials(u)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {memberName(u)}
          {!u.isActive && <Badge variant="outline" className="ml-2 text-[10px] align-middle">Deactivated</Badge>}
        </p>
        {memberName(u) !== u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
        <p className="text-xs text-muted-foreground md:hidden">Last tracked {lastTrackedLabel(u).toLowerCase()}</p>
      </div>
    </Link>
  )
}

function RowActions({ u, onEdit, onAccess }: { u: UserResponse; onEdit: () => void; onAccess?: () => void }) {
  const { user: currentUser } = useAuthStore()
  const toggleActive = useToggleActive()
  if (!currentUser || !canManage(currentUser, u)) {
    return onAccess ? <Button variant="outline" size="sm" className="text-xs" onClick={onAccess}>Access</Button> : null
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {onAccess && u.isActive && <Button variant="outline" size="sm" className="text-xs" onClick={onAccess}>Access</Button>}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${memberName(u)}`} />}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            className={`cursor-pointer ${u.isActive ? 'text-destructive' : ''}`}
            onClick={() => toggleActive.mutate(u)}
          >
            {u.isActive ? 'Deactivate' : 'Reactivate'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title} <span className="num font-normal">({count})</span>
      </h2>
      <div className="rounded-2xl glass-card overflow-x-auto">{children}</div>
    </section>
  )
}

const TH = 'px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
const TD = 'px-4 py-3 align-middle'

export default function UsersPage() {
  const { token, user: currentUser } = useAuthStore()
  const invalidate = useInvalidateUsers()
  const [addRoleOpen, setAddRoleOpen] = useState<Role | null>(null)
  const [accessFor, setAccessFor] = useState<UserResponse | null>(null)
  const [editing, setEditing] = useState<UserResponse | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data: userList = [], isLoading } = useQuery({
    queryKey: ['users-all', token],
    queryFn: () => users.list(token!, { includeInactive: true }),
    enabled: !!token && isManagerial(currentUser?.role),
  })

  const visibility = useMutation({
    mutationFn: (u: UserResponse) => users.update(token!, u.userId, { fullVisibility: !u.fullVisibility }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  if (!currentUser || !isManagerial(currentUser.role)) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access restricted to managers and admins</div>
  }

  const canAddStaff = isAdmin(currentUser.role)
  const q = search.trim().toLowerCase()
  const inactiveCount = userList.filter((u) => !u.isActive).length
  const shown = userList
    .filter((u) => showInactive || u.isActive)
    .filter((u) => !q || memberName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || memberName(a).localeCompare(memberName(b)))
  const members = shown.filter((u) => u.role === 'TEAM_MEMBER')
  const staff = shown.filter((u) => u.role !== 'TEAM_MEMBER')

  function handleMemberCreated(email: string) {
    setAddRoleOpen(null)
    invalidate()
    users.list(token!, { includeInactive: true }).then((list) => {
      const created = list.find((u) => u.email === email.toLowerCase())
      if (created) setAccessFor(created)
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Who&apos;s on the team, what they can see, and what they&apos;ve been tracking</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button>+ Add person</Button>} />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAddRoleOpen('TEAM_MEMBER')} className="cursor-pointer">Team member</DropdownMenuItem>
            {canAddStaff && (
              <>
                <DropdownMenuItem onClick={() => setAddRoleOpen('MANAGER')} className="cursor-pointer">Manager</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddRoleOpen('ADMIN')} className="cursor-pointer">Admin</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" />
        </div>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-primary h-4 w-4" />
            Show deactivated <span className="num">({inactiveCount})</span>
          </label>
        )}
      </div>

      <Section title="Team members" count={members.length}>
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr>
              <th className={TH}>Team member</th>
              <th className={`${TH} hidden md:table-cell`}>Last tracked</th>
              <th className={TH}>Visibility</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Loading…</td></tr>}
            {!isLoading && members.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-8">
                  {q ? 'No team members match.' : (
                    <>No team members yet. <button className="text-primary hover:underline" onClick={() => setAddRoleOpen('TEAM_MEMBER')}>Add one</button></>
                  )}
                </td>
              </tr>
            )}
            {members.map((u) => (
              <tr key={u.userId} className={`border-b border-white/5 last:border-0 ${u.isActive ? '' : 'opacity-60'}`}>
                <td className={TD}><MemberCell u={u} /></td>
                <td className={`${TD} text-muted-foreground whitespace-nowrap hidden md:table-cell`}>{lastTrackedLabel(u)}</td>
                <td className={TD}>
                  <button
                    onClick={() => visibility.mutate(u)}
                    disabled={!u.isActive}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
                      u.fullVisibility
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground'
                    }`}
                    title={u.fullVisibility ? 'Sees every client. Click to restrict to their access.' : 'Sees only their access. Click to show every client.'}
                  >
                    {u.fullVisibility ? 'All clients' : 'Their access'}
                  </button>
                </td>
                <td className={TD}>
                  <RowActions u={u} onEdit={() => setEditing(u)} onAccess={() => setAccessFor(u)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Managers & Admins" count={staff.length}>
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Role</th>
              <th className={`${TH} hidden md:table-cell`}>Last tracked</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {!isLoading && staff.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No managers or admins match.</td></tr>
            )}
            {staff.map((u) => (
              <tr key={u.userId} className={`border-b border-white/5 last:border-0 ${u.isActive ? '' : 'opacity-60'}`}>
                <td className={TD}><MemberCell u={u} /></td>
                <td className={TD}><Badge variant="secondary" className="text-xs">{roleLabel(u.role)}</Badge></td>
                <td className={`${TD} text-muted-foreground whitespace-nowrap hidden md:table-cell`}>{lastTrackedLabel(u)}</td>
                <td className={TD}><RowActions u={u} onEdit={() => setEditing(u)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {addRoleOpen && (
        <AddUserDialog
          role={addRoleOpen}
          onClose={() => setAddRoleOpen(null)}
          onCreated={addRoleOpen === 'TEAM_MEMBER' ? handleMemberCreated : () => { setAddRoleOpen(null); invalidate() }}
        />
      )}
      {accessFor && <AccessDialog member={accessFor} onClose={() => setAccessFor(null)} />}
      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
