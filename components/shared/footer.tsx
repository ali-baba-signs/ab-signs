import Image from 'next/image'
import Link from 'next/link'

const groups = [
  { title: 'Products', links: [['Vinyl Banners','/products?category=vinyl-banners'],['Mesh Banners','/products?category=mesh-banners'],['All Products','/products']] },
  { title: 'Design services', links: [['Design Online','/design'],['Browse Templates','/design'],['Upload Artwork','/design']] },
  { title: 'Company', links: [['About Us','/about-us'],['Contact','/contact'],['Blog','/blog'],['FAQ','/faq']] },
  { title: 'Legal', links: [['Terms of Service','/terms-of-service'],['Privacy Policy','/privacy-policy'],['Cookie Policy','/cookie-policy'],['Sitemap','/sitemap']] },
]

export function Footer() { return <footer className="bg-[#111] text-white"><div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 lg:py-20"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]"><div><Link href="/"><Image src="/logo.png" alt="Alibaba Signs" width={250} height={82} className="h-14 w-auto object-contain object-left brightness-0 invert" /></Link><p className="mt-5 max-w-sm text-sm leading-6 text-white/60">Custom banners, flags and online artwork tools for businesses, events and promotions.</p><a href="mailto:support@alibabasigns.com" className="mt-5 inline-block text-sm font-bold text-[#ff4b91]">support@alibabasigns.com</a></div>{groups.map((group) => <div key={group.title}><h2 className="text-sm font-black uppercase tracking-wider text-[#ff4b91]">{group.title}</h2><ul className="mt-5 space-y-3">{group.links.map(([label,href]) => <li key={label}><Link href={href} className="text-sm text-white/65 hover:text-white">{label}</Link></li>)}</ul></div>)}</div><div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Alibaba Signs. All rights reserved.</p><p>Custom print and signage for Australia.</p></div></div></footer> }
