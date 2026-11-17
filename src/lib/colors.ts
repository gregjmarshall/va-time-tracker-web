/**
 * Accent colours that muted and earthy, readable on the warm dark background.
 * Mirrors the --brand-* tokens in globals.css for places that need raw values (SVG, inline styles).
 */
export const ACCENT = {
  coral: '#ee6a4a',
  teal: '#7fb3a3',
  amber: '#d9a95b',
  sky: '#8fa5c8',
  pink: '#c48fa3',
  lime: '#a9b47c',
}

/** Distinct colours for clients, picked so neighbours in the list differ. */
const CLIENT_PALETTE = [ACCENT.coral, ACCENT.teal, ACCENT.amber, ACCENT.sky, ACCENT.pink, ACCENT.lime, '#b29fc4', '#c99a76']

/** A stable colour per client, so the same client looks the same everywhere. */
export function clientColor(clientId: number) {
  return CLIENT_PALETTE[Math.abs(clientId) % CLIENT_PALETTE.length]
}
