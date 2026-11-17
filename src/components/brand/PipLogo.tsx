/** Brand colours used by the logo (kept in sync with --brand-* in globals.css). */
export const BRAND = {
  coral: '#ee6a4a',
  ink: '#1c0f0a',
}

/**
 * The pip mark: a clock face on a coral tile, with the light "pip" marking time on the rim.
 * Same artwork as src/app/icon.svg.
 */
export function PipMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="pip">
      <rect width="32" height="32" rx="7" fill={BRAND.coral} />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke={BRAND.ink} strokeWidth="2.6" />
      <path d="M16 16l3.6-3.6" stroke={BRAND.ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.6" fill={BRAND.ink} />
      <circle cx="22" cy="10" r="3.6" fill="#f4efe8" stroke={BRAND.coral} strokeWidth="1.4" />
    </svg>
  )
}

/** Geometric "pip" wordmark; the dot of the i is the coral pip. Letters use currentColor. */
export function PipWordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <svg height={height} viewBox="0 0 42 31" className={className} role="img" aria-label="pip"
      fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
      <path d="M3.5 9v19.5" />
      <circle cx="9.5" cy="15" r="6" />
      <path d="M20.5 10v11" />
      <circle cx="20.5" cy="3.4" r="2.7" fill={BRAND.coral} stroke="none" />
      <path d="M29 9v19.5" />
      <circle cx="35" cy="15" r="6" />
    </svg>
  )
}

/** Mark and wordmark side by side. */
export function PipLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <PipMark size={size} />
      <PipWordmark height={size * 0.62} />
    </span>
  )
}
