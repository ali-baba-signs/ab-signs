import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Boxes, PenTool, Truck, Upload, WandSparkles } from 'lucide-react'
import { benefits, catalogHighlights } from '@/data/homepage'

const benefitIcons = [BadgeCheck, Boxes, PenTool, Truck]

export function BenefitsStrip() {
  return <section aria-label="Service benefits" className="border-b border-zinc-200 bg-white">
    <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-zinc-200 lg:grid-cols-4">
      {benefits.map((item, index) => {
        const Icon = benefitIcons[index]
        return <div key={item.title} className="flex gap-3 px-4 py-5 sm:px-7">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#ed1b68]" />
          <div><h2 className="text-sm font-bold">{item.title}</h2><p className="mt-1 hidden text-xs leading-5 text-zinc-500 sm:block">{item.description}</p></div>
        </div>
      })}
    </div>
  </section>
}

function Heading({ eyebrow, title, link }: { eyebrow: string; title: string; link?: string }) {
  return <div className="mb-8 flex items-end justify-between gap-4">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ed1b68]">{eyebrow}</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2></div>
    {link && <Link href={link} className="hidden items-center gap-1 text-sm font-bold hover:text-[#ed1b68] sm:flex">View all <ArrowRight className="h-4 w-4" /></Link>}
  </div>
}

export function CategoryGrid({ categories }: { categories: Array<{ id: string; name: string; description: string; href: string; image: string }> }) {
  if (!categories.length) return null
  return <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:py-24">
    <Heading eyebrow="Find your format" title="Shop by category" link="/products" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
      {categories.map((category) => <Link key={category.id} href={category.href} className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:border-[#ed1b68] hover:shadow-xl">
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100"><Image src={category.image} alt={category.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
        <div className="flex flex-1 flex-col p-4 sm:p-6"><h3 className="min-h-14 text-lg font-black sm:text-2xl">{category.name}</h3>
        <p className="mt-2 hidden h-[4.5rem] overflow-hidden text-sm leading-6 text-zinc-500 line-clamp-3 sm:block">
  {category.description}
</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-[#ed1b68]">Shop now <ArrowRight className="h-4 w-4" /></span></div>
      </Link>)}
    </div>
  </section>
}

export function ProductHighlights() {
  return <section className="bg-zinc-50 py-16 lg:py-24"><div className="mx-auto max-w-[1440px] px-4 sm:px-8">
    <Heading eyebrow="Existing catalogue" title="Popular print formats" link="/products" />
    <div className="grid gap-5 md:grid-cols-3">
      {catalogHighlights.map((product) => <article key={product.id} className="group rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <Link href={product.href}><div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100"><Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /></div></Link>
        <div className="p-3"><h3 className="text-xl font-black"><Link href={product.href}>{product.name}</Link></h3><p className="mt-2 text-sm leading-6 text-zinc-500">{product.description}</p><div className="mt-5 flex gap-2"><Link href={product.href} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#ed1b68]">View product</Link><Link href={`/design?productId=${product.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-bold hover:border-[#ed1b68] hover:text-[#ed1b68]">Customise</Link></div></div>
      </article>)}
    </div>
  </div></section>
}

export function PromotionGrid({ promotions }: { promotions: Array<{ id:string; headline:string; description:string; image:string; ctaLabel:string|null; ctaUrl:string|null; alignment:string }> }) {
  if (!promotions.length) return null
  return <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:py-24">
    <div className="space-y-8">{promotions.map((promo) => <article key={promo.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-white lg:grid-cols-2">
      <div className={`relative min-h-[320px] ${promo.alignment==='image_right'?'lg:order-2':''}`}><Image src={promo.image} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" /></div>
      <div className={`flex flex-col justify-center p-8 sm:p-12 ${promo.alignment==='image_right'?'lg:order-1':''}`}><h2 className="max-w-xl text-3xl font-black sm:text-4xl">{promo.headline}</h2><p className="mt-4 max-w-xl leading-7 text-white/70">{promo.description}</p>{promo.ctaLabel&&promo.ctaUrl&&<Link href={promo.ctaUrl} className="mt-7 inline-flex items-center gap-2 self-start text-sm font-bold text-white">{promo.ctaLabel}<ArrowRight className="h-4 w-4 text-[#ed1b68]" /></Link>}</div>
    </article>)}</div>
  </section>
}

export function DesignOnlineSection() {
  const steps = ['Choose your product and size', 'Pick a template or start blank', 'Add text, logos and graphics', 'Save your draft and continue to order']
  return <section className="overflow-hidden bg-[#111] text-white"><div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
    <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff4b91]">Design online</p><h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Professional signage starts with a clear idea.</h2><p className="mt-5 max-w-xl leading-7 text-white/65">Use editable templates or build your artwork from scratch with the Alibaba Signs canvas editor.</p><Link href="/design" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#ed1b68] px-6 text-sm font-bold hover:bg-[#c91556]">Start designing <WandSparkles className="h-4 w-4" /></Link></div>
    <ol className="grid gap-3 sm:grid-cols-2">{steps.map((step, index) => <li key={step} className="rounded-xl border border-white/10 bg-white/5 p-5"><span className="text-xs font-black text-[#ff4b91]">0{index + 1}</span><p className="mt-2 font-bold">{step}</p></li>)}</ol>
  </div></section>
}

export function ArtworkOptions() {
  const options = [
    { icon: WandSparkles, title: 'Design online', text: 'Use the live editor now.', href: '/design', enabled: true },
    { icon: Upload, title: 'Upload artwork', text: 'Choose a product and confirm a print-ready PDF, PNG, SVG, or EPS.', href: '/upload-artwork', enabled: true },
    { icon: PenTool, title: 'Design assistance', text: 'A managed assistance workflow is being prepared.', href: '', enabled: false },
  ]
  return <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:py-24"><Heading eyebrow="Choose your artwork path" title="Bring your design to print" /><div className="grid gap-4 md:grid-cols-3">{options.map(({ icon: Icon, ...option }) => <article key={option.title} className="rounded-xl border border-zinc-200 p-7"><Icon className="h-7 w-7 text-[#ed1b68]" /><h3 className="mt-5 text-xl font-black">{option.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{option.text}</p>{option.enabled ? <Link href={option.href} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#ed1b68]">Get started <ArrowRight className="h-4 w-4" /></Link> : <span className="mt-5 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">Coming later</span>}</article>)}</div></section>
}

export function SeoContent() {
  return <section className="border-t border-zinc-200 bg-zinc-50"><div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-8"><h2 className="text-2xl font-black">Custom signage designed around your business</h2><p className="mt-4 leading-7 text-zinc-600">Alibaba Signs brings product selection, editable artwork and print preparation into one practical online workflow. Explore vinyl banners, mesh banners and portable flags, then customise your chosen format in the browser.</p></div></section>
}
