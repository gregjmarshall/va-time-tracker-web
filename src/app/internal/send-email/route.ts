import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

// Temporary email relay for the pip backend. The backend's host blocks outgoing SMTP ports,
// so it POSTs each platform email here and Vercel sends it over SMTP (a Gmail account for now).
// Only the backend can call this: it must present the shared PIP_PROXY_SECRET. The SMTP
// credentials travel in the request (over HTTPS) so they live in one place, the backend's env.
// Remove once pip sends from its own domain via Resend.
export const runtime = 'nodejs'

type RelayRequest = {
  to: string
  subject: string
  text: string
  from: string
  fromName?: string
  replyTo?: string
  smtp: { host: string; port: number; starttls?: boolean; user?: string; pass?: string }
}

function authorised(header: string | null): boolean {
  const secret = process.env.PIP_PROXY_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

const isEmail = (s: unknown): s is string => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function POST(request: Request) {
  if (!authorised(request.headers.get('x-pip-proxy'))) {
    return Response.json({ message: 'Not found' }, { status: 404 })
  }
  let body: RelayRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: 'Bad request' }, { status: 400 })
  }
  const { to, subject, text, from, fromName, replyTo, smtp } = body ?? {}
  if (!isEmail(to) || !isEmail(from) || typeof subject !== 'string' || typeof text !== 'string' || !smtp?.host) {
    return Response.json({ message: 'Bad request' }, { status: 400 })
  }
  const port = Number(smtp.port) || 587
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && smtp.starttls !== false,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  })
  try {
    await transport.sendMail({
      from: { name: fromName || 'pip', address: from },
      to,
      replyTo: isEmail(replyTo) ? replyTo : undefined,
      subject,
      text,
    })
    return Response.json({ sent: true })
  } catch (e) {
    // Never echo credentials; the error message from nodemailer doesn't contain them.
    const message = e instanceof Error ? e.message : 'send failed'
    console.error('email relay: send failed:', message)
    return Response.json({ message: 'Send failed', detail: message }, { status: 502 })
  }
}
