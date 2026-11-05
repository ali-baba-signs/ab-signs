import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products } from '@/lib/db/schema'

const adminEntry = (process.env.NEXT_PUBLIC_ADMIN_ENTRY_PATH || 'staff-portal').replace(/^\/+|\/+$/g, '')

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.nextUrl.hostname.toLowerCase()
  if (hostname === 'www.alibabasigns.com.au' || (hostname === 'alibabasigns.com.au' && request.nextUrl.protocol === 'http:')) {
    const canonical = request.nextUrl.clone()
    canonical.protocol = 'https:'
    canonical.hostname = 'alibabasigns.com.au'
    return NextResponse.redirect(canonical, 308)
  }
  const oldProductUrl = /^\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname)
  if (oldProductUrl) {
    const [product] = await db.select({ slug: products.slug, active: products.active }).from(products).where(eq(products.id, oldProductUrl[1])).limit(1)
    if (product?.active) {
      const canonical = request.nextUrl.clone()
      canonical.pathname = `/products/${encodeURIComponent(product.slug)}`
      return NextResponse.redirect(canonical, 301)
    }
  }
  const publicPrefix = `/${adminEntry}`

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (pathname === publicPrefix || pathname.startsWith(`${publicPrefix}/`)) {
    const url = request.nextUrl.clone()
    url.pathname = `/admin${pathname.slice(publicPrefix.length)}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
