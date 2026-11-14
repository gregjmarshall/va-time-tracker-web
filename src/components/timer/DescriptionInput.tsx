'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { suggestions as suggestionsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/** Description field with suggestions from the user's own previous entries. */
export const DescriptionInput = forwardRef<HTMLInputElement, {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  required: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}>(function DescriptionInput({ value, onChange, onBlur, required, placeholder = 'What are you working on?', className, autoFocus }, ref) {
  const { token } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<string[]>([])

  useEffect(() => {
    if (!token || value.length < 2) { setList([]); return }
    const t = setTimeout(async () => {
      try { setList((await suggestionsApi.search(token, value)).suggestions.filter((s) => s !== value)) } catch { /**/ }
    }, 300)
    return () => clearTimeout(t)
  }, [value, token])

  return (
    <div className="relative">
      <Input
        ref={ref}
        autoFocus={autoFocus}
        placeholder={required ? placeholder : `${placeholder} (optional)`}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150)
          onBlur?.()
        }}
      />
      {open && list.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-[#151737]/98 border border-white/10 rounded-2xl shadow-2xl z-30 overflow-hidden backdrop-blur-2xl">
          {list.map((s) => (
            <button key={s} type="button"
              className="w-full text-left px-5 py-3 text-[13px] font-bold text-white/90 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
              onMouseDown={() => { onChange(s); setOpen(false) }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
