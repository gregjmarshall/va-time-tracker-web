'use client'

import { useEffect, useState } from 'react'

interface PricingTier {
  tier: number
  minMembers: number
  maxMembers: number | null
  monthlyPrice: number | null
  annualPrice: number | null
  contactUs: boolean
}
interface PricingModel { currency: string; trialDays: number; graceDays: number; annualFreeMonths: number; tiers: PricingTier[] }

/** Size bands to show if GET /api/pricing isn't available (prices then read "See Pricing"). */
const FALLBACK: PricingTier[] = [
  { tier: 1, minMembers: 0, maxMembers: 10, monthlyPrice: null, annualPrice: null, contactUs: false },
  { tier: 2, minMembers: 11, maxMembers: 25, monthlyPrice: null, annualPrice: null, contactUs: false },
  { tier: 3, minMembers: 26, maxMembers: 50, monthlyPrice: null, annualPrice: null, contactUs: false },
  { tier: 4, minMembers: 51, maxMembers: null, monthlyPrice: null, annualPrice: null, contactUs: true },
]

function band(t: PricingTier) {
  if (t.maxMembers === null) return `${t.minMembers - 1}+ team members`
  if (t.minMembers <= 1) return `Up to ${t.maxMembers} team members`
  return `${t.minMembers}–${t.maxMembers} team members`
}

/** Live price list from the public pricing API (config-driven), with a static fallback. */
export function PricingTable() {
  const [model, setModel] = useState<PricingModel | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((m: PricingModel | null) => { if (!cancelled && m?.tiers?.length) setModel(m) })
      .catch(() => { /* fallback below */ })
    return () => { cancelled = true }
  }, [])

  const money = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: model?.currency ?? 'GBP' }).format(Number(n))
  const tiers = model?.tiers ?? FALLBACK

  return (
    <div className="help-table">
      <table>
        <thead><tr><th>Team size</th><th>Monthly</th><th>Annual</th></tr></thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.tier}>
              <td>{band(t)}</td>
              <td className="num">{t.contactUs ? 'Contact us' : t.monthlyPrice != null ? `${money(t.monthlyPrice)}/mo` : 'See Pricing'}</td>
              <td className="num">{t.contactUs ? 'Contact us' : t.annualPrice != null ? `${money(t.annualPrice)}/yr` : 'See Pricing'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
