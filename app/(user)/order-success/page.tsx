import type { Metadata } from 'next'
import { OrderSuccessContent } from './OrderSuccessContent'
export const metadata:Metadata={title:'Order Confirmation | Alibaba Signs',description:'Your Alibaba Signs payment confirmation.'}
export default async function OrderSuccessPage({searchParams}:{searchParams:Promise<{order?:string}>}){const{order}=await searchParams;return <OrderSuccessContent orderNumber={order}/>}
