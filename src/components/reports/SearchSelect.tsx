'use client'

import { useState } from 'react'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface SearchOption {
  value: number
  label: string
  /** Secondary text shown muted after the label and matched by search, e.g. the client of a project */
  hint?: string
  color?: string
}

/** Single-select dropdown with type-to-search. `null` means "all". */
export function SearchSelect({
  options,
  value,
  onChange,
  allLabel,
  placeholder = 'Search…',
}: {
  options: SearchOption[]
  value: number | null
  onChange: (value: number | null) => void
  allLabel: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value) ?? null

  const pick = (v: number | null) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-2 max-w-64 px-3 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50',
          selected ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10'
        )}
      >
        {selected?.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected.color }} />}
        <span className="truncate">{selected ? selected.label : allLabel}</span>
        {selected ? (
          <span
            role="button"
            aria-label={`Clear ${allLabel}`}
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </span>
        ) : (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>No matches</CommandEmpty>
            <CommandItem value={`__all ${allLabel}`} data-checked={value === null} onSelect={() => pick(null)}>
              {allLabel}
            </CommandItem>
            {options.map(o => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.hint ?? ''} #${o.value}`}
                data-checked={o.value === value}
                onSelect={() => pick(o.value)}
              >
                {o.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: o.color }} />}
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="truncate text-xs text-muted-foreground">{o.hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
