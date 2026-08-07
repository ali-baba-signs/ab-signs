import { NextRequest, NextResponse } from 'next/server'

const adminEntry = (process.env.NEXT_PUBLIC_ADMIN_ENTRY_PATH || 'staff-portal').replace(/^\/+|\/+$/g, '')

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
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
