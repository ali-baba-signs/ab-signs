import type { Metadata } from 'next'
import { ShippingContent } from '@/components/content/legal-content'
export const metadata:Metadata={title:'Shipping Policy | Ali Baba Signs',description:'Ali Baba Signs production, delivery, courier and local pickup information.'}
export default function Page(){return <ShippingContent/>}
