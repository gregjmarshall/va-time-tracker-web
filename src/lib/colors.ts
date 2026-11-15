/**
 * Accent colours that contrast with the violet brand, readable on the dark navy background.
 * Mirrors the --brand-* tokens in globals.css for places that need raw values (SVG, inline styles).
 */
export const ACCENT = {
  coral: '#ff7a59',
  teal: '#2dd4bf',
  amber: '#fbbf24',
  sky: '#60a5fa',
  pink: '#f472b6',
  lime: '#a3e635',
}

/** Distinct colours for clients, picked so neighbours in the list differ. */
const CLIENT_PALETTE = [ACCENT.coral, ACCENT.teal, ACCENT.amber, ACCENT.sky, ACCENT.pink, ACCENT.lime, '#c084fc', '#fb923c']

/** A stable colour per client, so the same client looks the same everywhere. */
export function clientColor(clientId: number) {
  return CLIENT_PALETTE[Math.abs(clientId) % CLIENT_PALETTE.length]
}
