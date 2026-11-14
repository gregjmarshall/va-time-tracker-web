'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workspace } from '@/lib/api'
import { useWorkspace } from '@/lib/queries'
import { useAuthStore } from '@/stores/auth'

export default function SettingsPage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: ws, isLoading } = useWorkspace()
  const isAdmin = user?.role === 'ADMIN'

  const update = useMutation({
    mutationFn: (descriptionRequired: boolean) => workspace.update(token!, { descriptionRequired }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['workspace', token], updated)
      toast.success(updated.descriptionRequired ? 'Descriptions are now required' : 'Descriptions are now optional')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">{ws?.name ?? 'Workspace'} settings</p>

      <section className="mt-8 rounded-2xl glass-card p-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">Time tracking</h2>
        <label className={`mt-4 flex items-start gap-3 ${isAdmin ? 'cursor-pointer' : ''}`}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={ws?.descriptionRequired ?? true}
            disabled={!isAdmin || isLoading || update.isPending}
            onChange={(e) => update.mutate(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-white">Require a description on every time entry</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Entries can&apos;t be saved without saying what was worked on. A project is always required.
              {!isAdmin && ' Only Admins can change this.'}
            </span>
          </span>
        </label>
      </section>
    </div>
  )
}
