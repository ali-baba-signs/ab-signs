import { NextRequest } from 'next/server'
import { GET as getTemplate } from '../route'

// Serve editor data directly: reverse proxies may expose an internal HTTP origin.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const destination = new URL(request.url)
  destination.searchParams.set('editor', '1')
  return getTemplate(new NextRequest(destination, { headers: request.headers }), context)
}
