import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { contactSubmissions } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { forwardSupportEvent, type SupportEvent } from '@/lib/support/handler'
import { validateSupportSettings } from '@/lib/support/settings'
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!await getAdminSession())return NextResponse.json({error:{message:'Admin access is required.'}},{status:401})
  const {id}=await params
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:{message:'Invalid enquiry reference.'}},{status:400})
  const [row]=await db.select().from(contactSubmissions).where(eq(contactSubmissions.id,id)).limit(1)
  if(!row?.supportPayload)return NextResponse.json({error:{message:'Support event not found.'}},{status:404})
  if(row.emailStatus==='forwarded')return NextResponse.json({data:{message:'Already accepted by n8n. Check workflow execution before retrying.'}})
  try{
    await forwardSupportEvent(row.supportPayload as SupportEvent,validateSupportSettings((await loadStoreSettings()).support))
    await db.update(contactSubmissions).set({emailStatus:'forwarded',emailError:null,updatedAt:new Date()}).where(eq(contactSubmissions.id,id))
    return NextResponse.json({data:{message:'Accepted by n8n.'}})
  }catch{
    return NextResponse.json({error:{message:'Delivery failed. Check webhook credentials and n8n availability.'}},{status:502})
  }
}
