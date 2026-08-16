export const POLICY_REGISTRY = [
  { slug: 'privacy-policy', title: 'Privacy Policy', version: '2026-08', href: '/privacy-policy' },
  { slug: 'terms-of-service', title: 'Terms & Conditions', version: '2026-08', href: '/terms-of-service' },
  { slug: 'refund-returns-policy', title: 'Refund & Returns Policy', version: '2026-08', href: '/refund-returns-policy' },
  { slug: 'shipping-policy', title: 'Shipping Policy', version: '2026-08', href: '/shipping-policy' },
  { slug: 'warranty-disclaimer', title: 'Warranty Disclaimer', version: '2026-08', href: '/warranty-disclaimer' },
] as const

export function currentPolicyAcceptance() {
  return POLICY_REGISTRY.map(({ slug, title, version, href }) => ({ slug, title, version, href }))
}
