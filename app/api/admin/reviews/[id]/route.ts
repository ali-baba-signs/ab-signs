import { NextRequest,NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs,productReviews } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){const session=await getAdminSession();if(!session)return NextResponse.json({error:{message:'Admin access is required.'}},{status:401});const{id}=await params;const body=await request.json() as {status?:string};if(!['pending','published','hidden','flagged'].includes(body.status||''))return NextResponse.json({error:{message:'Invalid moderation status.'}},{status:400});const[review]=await db.transaction(async tx=>{const rows=await tx.update(productReviews).set({moderationStatus:body.status,moderatedBy:session.user.id,moderatedAt:new Date(),updatedAt:new Date()}).where(eq(productReviews.id,id)).returning();if(!rows[0])throw new Error('Review not found.');await tx.insert(adminActivityLogs).values(activityValues(session,{actionType:'review.moderated',entityType:'review',entityId:id,entityName:'Verified order review',description:`Marked review ${id} as ${body.status}.`,metadata:{status:body.status}}));return rows});return NextResponse.json({data:{review}})}
