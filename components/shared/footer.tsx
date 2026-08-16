import Image from 'next/image'
import Link from 'next/link'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { DEFAULT_STORE_SETTINGS } from '@/lib/store/settings'
import { SocialIcon } from '@/components/shared/social-icon'

const groups = [
  { title: 'Products', links: [['Vinyl Banners','/products?category=vinyl-banners'],['Mesh Banners','/products?category=mesh-banners'],['All Products','/products']] },
  { title: 'Design services', links: [['Design Online','/design'],['Browse Templates','/design'],['Upload Artwork','/design']] },
  { title: 'Company', links: [['About Us','/about-us'],['Contact','/contact'],['Blog','/blog'],['FAQ','/faq']] },
  { title: 'Legal / Policies', links: [['Policies & Legal','/policies'],['Terms & Conditions','/terms-of-service'],['Privacy Policy','/privacy-policy'],['Refund & Returns','/refund-returns-policy'],['Shipping Policy','/shipping-policy'],['Warranty Disclaimer','/warranty-disclaimer']] },
]

export async function Footer() {
  const settings = await loadStoreSettings().catch(() => DEFAULT_STORE_SETTINGS)
  const socials = settings.socialLinks.filter((link) => link.enabled).sort((a, b) => a.displayOrder - b.displayOrder)
  return <footer className="bg-[#111] text-white"><div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 lg:py-20"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]"><div><Link href="/"><Image src="/logo.png" alt={settings.storeName} width={250} height={82} className="h-14 w-auto object-contain object-left brightness-0 invert" /></Link><p className="mt-5 max-w-sm text-sm leading-6 text-white/60">Custom banners, flags and online artwork tools for businesses, events and promotions.</p><a href={`mailto:${settings.storeEmail}`} className="mt-5 block text-sm font-bold text-[#ff4b91]">{settings.storeEmail}</a>{settings.storePhone&&<a href={`tel:${settings.storePhone.replace(/[^+\d]/g,'')}`} className="mt-2 block text-sm text-white/70">{settings.storePhone}</a>}{settings.address&&<p className="mt-2 text-sm text-white/60">{settings.address}</p>}{socials.length>0&&<div className="mt-5 flex flex-wrap gap-2">{socials.map((link)=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.platform} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-[#ed1b68]"><SocialIcon platform={link.platform}/></a>)}</div>}</div>{groups.map((group) => <div key={group.title}><h2 className="text-sm font-black uppercase tracking-wider text-[#ff4b91]">{group.title}</h2><ul className="mt-5 space-y-3">{group.links.map(([label,href]) => <li key={label}><Link href={href} className="text-sm text-white/65 hover:text-white">{label}</Link></li>)}</ul></div>)}</div><div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p><p>{settings.footerText}</p></div></div></footer>
}
