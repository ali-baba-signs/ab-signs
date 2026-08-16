import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { adminActivityLogs, contactSubmissions } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'

export async function PUT(request:NextRequest, context:{params:Promise<{id:string}>}) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({error:{message:'Admin access is required.'}},{status:401})
  const { id } = await context.params
  const body = await request.json() as Record<string,unknown>
  const status = typeof body.status === 'string' ? body.status : ''
  if (!['new','read','resolved'].includes(status)) return NextResponse.json({error:{message:'Select a valid enquiry status.'}},{status:400})
  const now = new Date()
  const [enquiry] = await db.transaction(async(tx)=>{
    const rows = await tx.update(contactSubmissions).set({status,readAt:status==='new'?null:now,resolvedAt:status==='resolved'?now:null,updatedAt:now}).where(eq(contactSubmissions.id,id)).returning()
    if (rows[0]) await tx.insert(adminActivityLogs).values(activityValues(session,{actionType:'enquiry.status_changed',entityType:'contact_submission',entityId:id,entityName:rows[0].subject,description:`Marked enquiry ${id} as ${status}.`,metadata:{status}}))
    return rows
  })
  return enquiry ? NextResponse.json({data:{enquiry}}) : NextResponse.json({error:{message:'Enquiry not found.'}},{status:404})
}
