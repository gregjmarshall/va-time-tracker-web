import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Forwards /api/* to the pip backend and adds the shared X-Pip-Proxy secret, which nginx in
// front of the backend requires. (A next.config rewrite can't add request headers.)
//   BACKEND_URL      e.g. https://<backend host>  (server-only; defaults to a local backend in dev)
//   PIP_PROXY_SECRET Vercel *Sensitive* env var; optional in local dev against a bare backend
export function proxy(request: NextRequest) {
  const backend = process.env.BACKEND_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : undefined)
  if (!backend) {
    return NextResponse.json({ message: 'Backend not configured' }, { status: 502 })
  }

  const { pathname, search } = request.nextUrl
  const target = new URL(pathname + search, backend)

  const headers = new Headers(request.headers)
  headers.delete('x-pip-proxy') // never trust a client-supplied value
  const secret = process.env.PIP_PROXY_SECRET
  if (secret) headers.set('x-pip-proxy', secret)

  return NextResponse.rewrite(target, { request: { headers } })
}

export const config = {
  matcher: '/api/:path*',
}
