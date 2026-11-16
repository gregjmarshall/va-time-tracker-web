'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** A read-only link with a Copy button (invite links are shown once). */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the field is selectable */
    }
  }
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Invite link" />
      <Button type="button" variant="outline" onClick={copy} className="shrink-0">
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/** The invite link on this site (the backend's FRONTEND_URL may not match the domain in use). */
export function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`
}
