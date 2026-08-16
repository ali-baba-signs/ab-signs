import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/content/content-page'
import { POLICY_REGISTRY } from '@/lib/policies/registry'
export const metadata:Metadata={title:'Policies & Legal | Ali Baba Signs',description:'Current Ali Baba Signs terms, privacy, shipping, returns and warranty policies.'}
export default function Page(){return <ContentPage eyebrow="Legal" title="Policies & Legal" intro="Review the current policies that apply when you browse, contact us, or place an order."><div className="grid gap-4 sm:grid-cols-2">{POLICY_REGISTRY.map((policy)=><Link key={policy.slug} href={policy.href} className="rounded-xl border bg-card p-5 transition hover:border-primary"><h2 className="font-bold">{policy.title}</h2><p className="mt-2 text-sm text-muted-foreground">Current version: {policy.version}</p><p className="mt-3 text-sm font-semibold text-primary">Read policy →</p></Link>)}</div><p className="mt-8 text-sm text-muted-foreground">The version accepted at checkout is stored with the order, so later policy updates do not change the historical acceptance record.</p></ContentPage>}
