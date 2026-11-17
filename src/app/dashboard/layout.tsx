'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'
import { timeEntries } from '@/lib/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { roleLabel } from '@/lib/types'
import { PipMark, PipWordmark } from '@/components/brand/PipLogo'
import { GlobalTimer } from '@/components/timer/GlobalTimer'
import { useOpenAccessRequests } from '@/components/onboarding/AccessRequestsPanel'

const workerNav = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    href: '/dashboard/timesheet',
    label: 'Timesheet',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4m8-4v4M8 13h2m4 0h2M8 17h2m4 0h2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/reports',
    label: 'My Time',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/projects',
    label: 'Projects',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    stub: true,
  },
  { href: '/help', label: 'Help', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg> },
]

const adminNav = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/projects',
    label: 'Projects',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/users',
    label: 'Team',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/capacity',
    label: 'Capacity',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h10M4 18h6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/cover',
    label: 'Holiday cover',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/timesheet',
    label: 'Timesheet',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4m8-4v4M8 13h2m4 0h2M8 17h2m4 0h2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  { href: '/help', label: 'Help', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg> },
]

/** Platform owners only (operators of pip, not a workspace role). */
const ownerNav = [
  {
    href: '/dashboard/owner',
    label: 'Owner',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8L12 3z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { token, user, clearAuth } = useAuthStore()
  const mounted = useAuthHydrated()
  // Mobile only: the sidebar is a slide-in drawer below md.
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (mounted && !token) router.replace('/login')
  }, [mounted, token, router])

  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
    refetchInterval: 30_000,
  })

  // Badge on Team: people waiting to be put on projects
  const managerial = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const { data: openRequests = [] } = useOpenAccessRequests(managerial)

  if (!mounted || !token || !user) return null

  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || user.email[0].toUpperCase()
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const isTimerRunning = activeTimer?.isRunning ?? false

  function handleLogout() {
    clearAuth()
    router.replace('/login')
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      )}
      {/* Sidebar: static from md up, a drawer below */}
      <aside
        id="dashboard-nav"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col border-r border-sidebar-border transition-transform duration-200 md:static md:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'var(--sidebar)' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 mb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {isTimerRunning && (
                <svg className="absolute pointer-events-none"
                  style={{ inset: -7, width: 'calc(100% + 14px)', height: 'calc(100% + 14px)' }}
                  viewBox="0 0 54 54">
                  <circle cx="27" cy="27" r="24" fill="none"
                    stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="10 5" strokeLinecap="round"
                    style={{
                      transformOrigin: '27px 27px',
                      transform: 'rotate(-90deg)',
                      animation: 'timer-march 1.2s linear infinite, timer-glow 2s ease-in-out infinite',
                    }}
                  />
                </svg>
              )}
              <PipMark size={30} className={cn('transition-transform', isTimerRunning && 'scale-95')} />
            </div>
            <PipWordmark height={20} className="text-foreground" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-px overflow-y-auto">
          {[...(user.role === 'TEAM_MEMBER' ? workerNav : adminNav), ...(user.isOwner ? ownerNav : [])].map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={'stub' in item && item.stub ? false : undefined}
                onClick={() => setNavOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group relative',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/60'
                )}
              >
                <div className={cn(
                  "transition-colors",
                  active ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-foreground"
                )}>
                  {item.icon}
                </div>
                {item.label}
                {item.href === '/dashboard/users' && openRequests.length > 0 && (
                  <span className="num ml-auto min-w-5 h-5 px-1.5 rounded-md bg-primary text-primary-foreground text-[11px] flex items-center justify-center"
                    aria-label={`${openRequests.length} waiting for access`}>{openRequests.length}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-sidebar-accent/60 transition-colors group">
            <Avatar className="h-8 w-8 text-xs">
              <AvatarFallback className="bg-secondary text-foreground text-[10px] font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main: timer bar on every page, content scrolls beneath it */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        <header className="relative z-30 flex-shrink-0 flex items-center gap-3 border-b border-border bg-background px-4 sm:px-6 py-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="md:hidden -ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
            aria-label="Open menu"
            aria-controls="dashboard-nav"
            aria-expanded={navOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
          </button>
          <div className="flex-1 min-w-0"><GlobalTimer /></div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
