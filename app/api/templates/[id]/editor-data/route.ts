import { NextRequest, NextResponse } from 'next/server'

// Keep the heavyweight canonical Fabric JSON on a purpose-specific URL.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const destination = new URL(`/api/templates/${id}`, request.url)
  destination.search = request.nextUrl.search
  destination.searchParams.set('editor', '1')
  return NextResponse.redirect(destination)
}
