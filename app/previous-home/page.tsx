import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Heart, Search, ShoppingBag, Upload, WandSparkles } from 'lucide-react'

const featured = [
  {
    title: 'Custom Vinyl Banners',
    text: 'Weather-ready storefront, event, and roadside banners.',
    href: '/products?category=vinyl_banners',
  },
  {
    title: 'Mesh Banners',
    text: 'Wind-friendly banners for fences, jobsites, and outdoor spaces.',
    href: '/products?category=mesh_banners',
  },
  {
    title: 'Custom Flags',
    text: 'Feather, teardrop, rectangle, wall, and pennant flags.',
    href: '/products?category=flags',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#231f20]">
      <header className="border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 text-xs sm:px-6 lg:px-8">
          <p className="font-medium text-[#ed1b68]">Fast custom signs, banners, and print-ready designs.</p>
          <Link href="/sign-in" className="hover:text-[#ed1b68]">Sign in</Link>
        </div>

        <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center">
            <Image src="/blogo.png" alt="Ali Baba Signs" width={220} height={72} priority className="h-12 w-auto" />
          </Link>

          <label className="relative hidden flex-1 lg:block">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2" />
            <input
              className="h-12 w-full rounded-md border border-[#bdbdbd] bg-white px-5 pr-12 text-sm outline-none transition focus:border-[#ed1b68] focus:ring-2 focus:ring-[#ed1b68]/20"
              placeholder="Search banners, flags, decals..."
              type="search"
            />
          </label>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/products" className="hidden items-center gap-2 px-3 py-2 text-sm font-medium hover:text-[#ed1b68] md:flex">
              <Heart className="h-5 w-5" />
              Favorites
            </Link>
            <Link href="/cart" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#e0e0e0] hover:border-[#ed1b68]" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#f4f4f4]">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute right-0 top-0 h-full w-3/5 bg-[linear-gradient(110deg,transparent_0%,transparent_18%,rgba(237,27,104,.08)_18%,rgba(237,27,104,.08)_60%,rgba(35,31,32,.08)_60%)]" />
          <div className="absolute right-14 top-10 hidden h-64 w-[520px] rotate-[-2deg] rounded-sm bg-white shadow-2xl md:block">
            <div className="h-8 bg-[#ed1b68]" />
            <div className="mt-4 items-center p-4">
              <Image src="/blogo.png" alt="Printed Ali Baba Signs banner preview" width={330} height={77} className="h-auto w-64" />
              <div className="mt-8 grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((item) => (
                  <span key={item} className="h-10 rounded-sm bg-[#231f20]/10" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto grid min-h-[470px] max-w-7xl items-center px-4 py-12 sm:px-6 lg:grid-cols-[0.82fr_1fr] lg:px-8">
          <div className="max-w-xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#ed1b68]">Custom Signage Studio</p>
            <h1 className="text-4xl font-black leading-[0.96] sm:text-5xl lg:text-6xl">
              High-Quality Custom Banners & Flags.
              <span className="block text-[#ed1b68]">Print-Ready Designs.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#5f5f5f]">
              Upload your artwork, customize a proven template, or start from scratch with durable signage built for storefronts, launches, events, and outdoor promotions.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-md bg-[#ed1b68] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#c91556]">
                Start shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/design" className="inline-flex items-center gap-2 rounded-md border border-[#231f20] bg-white px-5 py-3 text-sm font-bold transition hover:border-[#ed1b68] hover:text-[#ed1b68]">
                Use design editor
                <WandSparkles className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ed1b68]">Featured Solutions</p>
          <h2 className="mt-2 text-2xl font-black">Signage built for every launch</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {featured.map((item) => (
            <Link key={item.title} href={item.href} className="rounded-md border border-[#e2e2e2] bg-white p-6 shadow-sm transition hover:border-[#ed1b68] hover:shadow-md">
              <h3 className="text-xl font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#656565]">{item.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#ed1b68]">
                Browse now <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#eeeeee] bg-[#f7f7f7] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ed1b68]">Streamlined configuration flow</p>
          <h2 className="mt-2 text-2xl font-black">From artwork to pickup, we cover every step</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { icon: Upload, title: 'Upload', text: 'Send artwork or start with a layout sized for your sign.' },
              { icon: WandSparkles, title: 'Customize', text: 'Choose materials, dimensions, finishing, and print options.' },
              { icon: ShoppingBag, title: 'Print & Ship', text: 'Approve your order and let the production team handle the rest.' },
            ].map((step, index) => (
              <div key={step.title}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#ed1b68] shadow-sm ring-1 ring-[#e2e2e2]">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="mt-4 block text-xs font-black text-[#ed1b68]">0{index + 1}</span>
                <h3 className="mt-1 text-lg font-black">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#656565]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
