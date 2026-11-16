import type { NextConfig } from 'next'

// /api/* is forwarded to the backend by src/proxy.ts (it adds the X-Pip-Proxy header).
const nextConfig: NextConfig = {}

export default nextConfig
