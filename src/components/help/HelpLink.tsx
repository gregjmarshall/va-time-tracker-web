import Link from 'next/link'
import type { HelpSlug } from '@/app/help/sections'
import { cn } from '@/lib/utils'

/** Small "?" that opens the help page for a screen in a new tab (so a running timer or open dialog isn't lost). */
export function HelpLink({ slug, anchor, label, className }: { slug: HelpSlug; anchor?: string; label?: string; className?: string }) {
  return (
    <Link
      href={`/help/${slug}${anchor ? `#${anchor}` : ''}`}
      target="_blank"
      rel="noopener"
      prefetch={false}
      aria-label={label ?? 'Help for this screen (opens in a new tab)'}
      title={label ?? 'Help'}
      className={cn(
        'inline-flex size-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] font-bold leading-none text-muted-foreground align-middle transition-colors hover:border-teal/60 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
        className,
      )}
    >
      ?
    </Link>
  )
}
