/** Help navigation: each section lists its pages (content/<slug>.md) in order. */
export const HELP_SECTIONS = [
  { title: 'Getting started', accent: 'var(--brand-sky)', slugs: ['what-is-pip', 'roles', 'first-login'] },
  {
    title: 'Team members',
    accent: 'var(--brand-teal)',
    slugs: ['timer', 'manual-entries', 'rounding-and-billable', 'my-projects', 'my-time', 'timesheets', 'holiday-cover'],
  },
  {
    title: 'Managers and Admins',
    accent: 'var(--brand-coral)',
    slugs: ['clients', 'retainers', 'projects', 'team', 'reports', 'timesheet-approvals', 'capacity', 'audit-trail'],
  },
  { title: 'Account and billing', accent: 'var(--brand-amber)', slugs: ['trial-and-plans', 'invoices'] },
  { title: 'FAQ', accent: 'var(--brand-sky)', slugs: ['faq'] },
] as const satisfies readonly { title: string; accent: string; slugs: readonly string[] }[]

export type HelpSlug = (typeof HELP_SECTIONS)[number]['slugs'][number]
