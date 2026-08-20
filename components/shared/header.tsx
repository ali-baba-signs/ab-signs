'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession, signOut } from '@/lib/auth-client'
import { useCart } from '@/lib/cart-context'
import { promoMessages } from '@/data/homepage'

type NavigationCategory = { id: string; name: string; href: string; children: Array<{ id: string; name: string; href: string }> }

export function Header() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { items } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [navigation, setNavigation] = useState<NavigationCategory[]>([])

  useEffect(() => {
    void fetch('/api/navigation').then((response) => response.ok ? response.json() : null).then((payload) => setNavigation(payload?.data?.navigation || [])).catch(() => setNavigation([]))
  }, [])

  const logout = async () => {
    await signOut()
    setAccountOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="relative z-50 bg-white text-[#111]">
      <div className="bg-[#111] text-white">
        <div className="mx-auto flex min-h-9 max-w-[1440px] items-center justify-center gap-6 overflow-hidden px-4 text-[11px] font-semibold uppercase tracking-wider sm:justify-between">
          {promoMessages.map((message, index) => <span key={message} className={index > 0 ? 'hidden md:inline' : ''}>{message}</span>)}
        </div>
      </div>

      <div className="border-b border-zinc-200">
        <div className="mx-auto grid min-h-20 max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:gap-6 sm:px-8">
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation" className="grid h-11 w-11 place-items-center rounded-md hover:bg-zinc-100 lg:hidden">
            {menuOpen ? <X /> : <Menu />}
          </button>
          <Link href="/" className="hidden shrink-0 lg:block"><Image src="/blogo.png" alt="Alibaba Signs" width={210} height={70} priority className="h-12 w-auto" /></Link>
          <Link href="/" className="justify-self-center lg:hidden"><Image src="/blogo.png" alt="Alibaba Signs" width={150} height={50} priority className="h-9 w-auto" /></Link>

          <form action="/products" className="relative hidden w-full max-w-2xl justify-self-center lg:block">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" name="search" type="search" placeholder="What are you looking for?" className="h-12 w-full rounded-md border border-zinc-300 bg-zinc-50 px-4 pr-12 text-sm outline-none transition focus:border-[#ed1b68] focus:bg-white focus:ring-2 focus:ring-[#ed1b68]/15" />
            <button aria-label="Search" className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded text-[#ed1b68]"><Search className="h-5 w-5" /></button>
          </form>

          <div className="flex items-center justify-self-end">
            <Link href="/contact" className="hidden px-3 py-2 text-xs font-bold hover:text-[#ed1b68] xl:block"><span className="block text-[10px] font-medium text-zinc-500">Need help?</span>Contact us</Link>
            <div className="relative">
              <button type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-zinc-100">
                <UserRound className="h-5 w-5" /><span className="hidden text-sm font-bold sm:inline">{isPending ? 'Account' : session?.user?.name?.split(' ')[0] || 'Account'}</span>
              </button>
              {accountOpen && <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
                {session?.user ? <>
                  <p className="truncate px-3 py-2 text-xs text-zinc-500">{session.user.email}</p>
                  <Link href="/account/profile" onClick={() => setAccountOpen(false)} className="block rounded px-3 py-2 text-sm font-medium hover:bg-zinc-100">My profile</Link>
                  <Link href="/account/orders" onClick={() => setAccountOpen(false)} className="block rounded px-3 py-2 text-sm font-medium hover:bg-zinc-100">My orders</Link>
                  <Link href="/account/offers" onClick={() => setAccountOpen(false)} className="block rounded px-3 py-2 text-sm font-medium hover:bg-zinc-100">My offers</Link>
                  <button onClick={logout} className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">Sign out</button>
                </> : <>
                  <Link href="/sign-in" onClick={() => setAccountOpen(false)} className="block rounded bg-[#ed1b68] px-3 py-2 text-center text-sm font-bold text-white">Sign in</Link>
                  <Link href="/sign-up" onClick={() => setAccountOpen(false)} className="mt-1 block rounded px-3 py-2 text-center text-sm font-medium hover:bg-zinc-100">Create account</Link>
                </>}
              </div>}
            </div>
            <Link href="/cart" aria-label={`Cart with ${items.length} items`} className="relative grid h-11 w-11 place-items-center rounded-md hover:bg-zinc-100"><ShoppingBag className="h-5 w-5" />{items.length > 0 && <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#ed1b68] px-1 text-[10px] font-bold text-white">{items.length}</span>}</Link>
          </div>
        </div>
        <form action="/products" className="relative mx-4 mb-4 lg:hidden">
          <input name="search" aria-label="Search products" type="search" placeholder="What are you looking for?" className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-4 pr-11 text-sm" />
          <button aria-label="Search" className="absolute right-1 top-0 grid h-11 w-10 place-items-center"><Search className="h-5 w-5" /></button>
        </form>
      </div>

      <nav aria-label="Product categories" className={`${menuOpen ? 'block' : 'hidden'} border-b border-zinc-200 bg-white lg:block`}>
        <div className="mx-auto flex max-w-[1440px] flex-col px-4 lg:h-12 lg:flex-row lg:items-center lg:gap-1 lg:px-8">
          <Link href="/products" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-sm font-bold hover:text-[#ed1b68]">All products</Link>
          <Link href="/offers" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-sm font-bold text-[#ed1b68] hover:text-[#ed1b68]">Offers &amp; Vouchers</Link>
          {navigation.map((category) => <div key={category.id} className="group relative">
            <Link href={category.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between gap-1 px-4 py-3 text-sm font-bold hover:text-[#ed1b68]">{category.name}<ChevronDown className="hidden h-3.5 w-3.5 lg:block" /></Link>
            <div className="border-l border-zinc-200 pl-3 lg:invisible lg:absolute lg:left-0 lg:top-full lg:w-60 lg:rounded-b-lg lg:border lg:bg-white lg:p-2 lg:pl-2 lg:opacity-0 lg:shadow-xl lg:transition lg:group-hover:visible lg:group-hover:opacity-100">
              {category.children.map((child) => <Link key={child.id} href={child.href} onClick={() => setMenuOpen(false)} className="block rounded px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-[#ed1b68]">{child.name}</Link>)}
            </div>
          </div>)}
          <Link href="/design" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-sm font-black text-[#ed1b68] lg:ml-auto">Design online</Link>
        </div>
      </nav>
    </header>
  )
}
