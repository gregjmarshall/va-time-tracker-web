'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { timeEntries } from '@/lib/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const workerNav = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    href: '/dashboard/work',
    label: 'My Work',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    stub: true,
  },
  {
    href: '/dashboard/reports',
    label: 'My Time',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
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
    href: '/dashboard/users',
    label: 'Team',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { token, user, clearAuth } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && !token) router.replace('/login')
  }, [mounted, token, router])

  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
    refetchInterval: 30_000,
  })

  if (!mounted || !token || !user) return null

  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || user.email[0].toUpperCase()
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const isTimerRunning = activeTimer?.isRunning ?? false

  function handleLogout() {
    clearAuth()
    router.replace('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-sidebar-border"
        style={{ background: 'linear-gradient(180deg, #7c5cf6 0%, #3a258c 35%, #1c1e3d 100%)' }}>
        {/* Logo */}
        <div className="h-20 flex items-center px-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {isTimerRunning && (
                <svg className="absolute pointer-events-none"
                  style={{ inset: -7, width: 'calc(100% + 14px)', height: 'calc(100% + 14px)' }}
                  viewBox="0 0 54 54">
                  <circle cx="27" cy="27" r="24" fill="none"
                    stroke="#4ade80" strokeWidth="2.5" strokeDasharray="10 5" strokeLinecap="round"
                    style={{
                      transformOrigin: '27px 27px',
                      transform: 'rotate(-90deg)',
                      animation: 'timer-march 1.2s linear infinite, timer-glow 2s ease-in-out infinite',
                    }}
                  />
                </svg>
              )}
              <div className={cn(
                'w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg shadow-black/20 transition-all',
                isTimerRunning
                  ? 'bg-white/20 border-white/30'
                  : 'bg-white/10 border-white/10'
              )}>
                {isTimerRunning ? (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="5" y="4" width="4" height="16" rx="1.5" />
                    <rect x="15" y="4" width="4" height="16" rx="1.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="font-bold text-white text-base tracking-tight">dot time</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {(user.role === 'VA' ? workerNav : adminNav).map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={'stub' in item && item.stub ? false : undefined}
                className={cn(
                  'flex items-center gap-3.5 px-6 py-4 rounded-[20px] text-[15px] font-bold transition-all group relative overflow-hidden',
                  active
                    ? 'bg-white/15 text-white shadow-xl backdrop-blur-md'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                )}
              >
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7c5cf6]" />
                )}
                <div className={cn(
                  "transition-colors",
                  active ? "text-white" : "text-white/30 group-hover:text-white/70"
                )}>
                  {item.icon}
                </div>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border/30">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-all group">
            <Avatar className="h-9 w-9 text-xs shadow-lg">
              <AvatarFallback className="bg-primary text-white text-[10px] font-bold border border-white/20">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white/90 truncate">{displayName}</p>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{user.role === 'MANAGER' ? 'Admin' : 'Worker'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
