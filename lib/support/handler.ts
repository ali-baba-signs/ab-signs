import 'server-only'
import { createHash } from 'node:crypto'
import { and, count, eq, gte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { contactSubmissions, orders } from '@/lib/db/schema'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { ORDER_STATUS_LABELS, normalizeOrderStatus } from '@/lib/orders/workflow'
import { createPresignedDownloadUrl, uploadObject } from '@/lib/storage/r2'
import { registerStorageAsset } from '@/lib/storage/asset-records'
import { sanitizeFilename } from '@/lib/storage/upload-validation'
import { supportAvailability, validateSupportSettings, type SupportSettings } from './settings'
import { SupportError, type SupportMessage } from './validation'
import { supportWebhookUrl } from './security'
import { notificationPolicy, supportIntent } from './rules'

export type SupportIdentity = { id: string; email: string; emailVerified: boolean } | null
export type SupportArtwork = {filename:string;contentType:string;content:Buffer}
export type SupportEvent = SupportMessage & {eventId:string;timestamp:string;priority:'HIGH'|'NORMAL';artworkExpected?:boolean;artwork:{key:string;filename:string;contentType:string;size:number}|null;orderStatus:{status:string;nextStep:string;trackingNumber:string|null;deliveryEstimate:string|null}|null}

export async function verifiedSupportOrder(message: SupportMessage, user: SupportIdentity) {
  if(message.category!=='Order status')return null
  if(!user?.emailVerified || user.email.toLowerCase()!==message.customerEmail)return null
  const [order]=await db.select({userId:orders.userId,status:orders.status,trackingNumber:orders.trackingNumber,expectedDeliveryAt:orders.expectedDeliveryAt}).from(orders).where(and(eq(orders.orderNumber,message.orderNumber),eq(orders.customerEmail,message.customerEmail))).limit(1)
  if(!order || order.userId && order.userId!==user.id)return null
  const status=normalizeOrderStatus(order.status)
  const nextStep = status==='artwork_pending' ? 'Your uploaded artwork is awaiting review.' : status==='pending_design_confirmation' ? 'Review and confirm your design in your account.' : status==='design_revision_required' ? 'Review the requested artwork changes in your account.' : status==='awaiting_payment' ? 'Complete payment through your existing checkout.' : status==='ready_for_pickup' ? 'Check your account for pickup instructions.' : ['dispatched','out_for_delivery'].includes(status) ? 'Check your account for delivery updates.' : ['delivered','completed'].includes(status) ? 'Your order is complete. Contact support if you need help.' : 'Check your account for the next order update, or contact our team.'
  return {status:ORDER_STATUS_LABELS[status],nextStep,trackingNumber:order.trackingNumber,deliveryEstimate:order.expectedDeliveryAt?.toISOString()||null}
}

export function supportPayload(event: SupportEvent, settings: SupportSettings, artworkUrl?: string) {
  const availability=supportAvailability(settings,new Date(event.timestamp))
  const intent=supportIntent(event.action,event.message,event.category)
  const policy=notificationPolicy(intent)
  return {...event,intent,notifyTeam:policy.notifyTeam,sendCustomerEmail:policy.customerEmail,artwork:event.artwork?{...event.artwork,downloadUrl:artworkUrl,expiresInSeconds:900}:null,artworkUploaded:Boolean(event.artwork),availability,acknowledgement:availability.response,businessHours:{enabled:settings.businessHoursEnabled,timezone:settings.timezone,openingDays:settings.openingDays,openingTime:settings.openingTime,closingTime:settings.closingTime,businessHoursResponse:settings.businessHoursResponse,afterHoursResponse:settings.afterHoursResponse},notification:{enabled:policy.notifyTeam,emails:policy.notifyTeam?settings.notificationEmails:[],subject:'New Alibaba Signs Support Request',priority:event.priority},schemaVersion:1}
}

export async function forwardSupportEvent(event: SupportEvent, settings: SupportSettings, send: typeof fetch = fetch) {
  const policy=notificationPolicy(supportIntent(event.action,event.message,event.category))
  if(!policy.notifyTeam && !policy.customerEmail)return
  if(event.artworkExpected && !event.artwork)throw new Error('Support artwork upload did not complete; contact the customer before forwarding.')
  const secret=process.env.SUPPORT_WEBHOOK_SECRET
  if(!secret || secret.length<32)throw new Error('Support webhook secret is not configured.')
  if(!settings.notificationEmails.length)throw new Error('Support notification emails are not configured.')
  const url=supportWebhookUrl(settings.webhookUrl)
  const downloadUrl=event.artwork ? await createPresignedDownloadUrl(event.artwork.key,900):undefined
  const response=await send(url,{method:'POST',headers:{'content-type':'application/json','x-support-webhook-secret':secret,'x-support-event-id':event.eventId},body:JSON.stringify(supportPayload(event,settings,downloadUrl)),redirect:'error',signal:AbortSignal.timeout(10000)})
  // A 2xx means n8n accepted the event, not that downstream email was delivered.
  if(!response.ok)throw new Error(`Support webhook returned HTTP ${response.status}.`)
  await response.body?.cancel()
}

export async function processSupportMessage(message:SupportMessage, request:Request, user:SupportIdentity=null, artwork?:SupportArtwork) {
  const settings=validateSupportSettings((await loadStoreSettings()).support)
  const ip=request.headers.get('x-real-ip')||request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
  const salt=process.env.CONTACT_RATE_LIMIT_SALT||process.env.BETTER_AUTH_SECRET
  if(!salt)throw new SupportError('Support is temporarily unavailable.',503,'SUPPORT_NOT_CONFIGURED')
  const ipHash=createHash('sha256').update(`${salt}:${ip}`).digest('hex')
  const event:SupportEvent={...message,eventId:crypto.randomUUID(),timestamp:new Date().toISOString(),priority:message.category==='Custom quote'?'HIGH':'NORMAL',artworkExpected:Boolean(artwork),artwork:null,orderStatus:await verifiedSupportOrder(message,user)}
  await db.transaction(async(tx)=>{
    // Serialize same-IP/email submissions across every VPS worker before counting.
    for(const key of [`ip:${ipHash}`,`email:${message.customerEmail}`].sort())await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)
    const [recent]=await tx.select({value:count()}).from(contactSubmissions).where(and(or(eq(contactSubmissions.ipHash,ipHash),eq(contactSubmissions.email,message.customerEmail)),gte(contactSubmissions.createdAt,new Date(Date.now()-15*60*1000))))
    if(Number(recent?.value||0)>=5)throw new SupportError('Too many support requests. Please wait 15 minutes.',429,'RATE_LIMITED')
    await tx.insert(contactSubmissions).values({id:event.eventId,name:message.customerName,email:message.customerEmail,phone:message.phone||null,company:message.company||null,orderNumber:message.orderNumber||null,enquiryType:message.category,subject:message.category==='Custom quote'?'HIGH — Custom quote':message.subject||'Support — '+message.category,message:message.message,ipHash,userAgent:request.headers.get('user-agent')?.slice(0,500)||null,supportPayload:event})
  })
  try {
    if(artwork){
      const key=`uploads/support/${event.eventId}/${crypto.randomUUID()}-${sanitizeFilename(artwork.filename)}`
      await uploadObject({key,body:artwork.content,contentType:artwork.contentType})
      event.artwork={key,filename:artwork.filename,contentType:artwork.contentType,size:artwork.content.length}
      await db.update(contactSubmissions).set({supportPayload:event}).where(eq(contactSubmissions.id,event.eventId))
      await registerStorageAsset({key,contentType:artwork.contentType,size:artwork.content.length,uploadedBy:user?.id})
    }
    const policy=notificationPolicy(supportIntent(event.action,event.message,event.category))
    await forwardSupportEvent(event,settings)
    await db.update(contactSubmissions).set({emailStatus:policy.notifyTeam||policy.customerEmail?'forwarded':'not_required',emailError:null,updatedAt:new Date()}).where(eq(contactSubmissions.id,event.eventId))
    return {id:event.eventId,message:supportAvailability(settings,new Date(event.timestamp)).response,orderStatus:event.orderStatus,verificationRequired:message.category==='Order status'&&!event.orderStatus}
  }catch(error){
    const detail=error instanceof Error&&/not configured|HTTP \d+|hostname is not allowed/.test(error.message)?error.message:'Support webhook delivery failed or timed out.'
    await db.update(contactSubmissions).set({emailStatus:'failed',emailError:detail,updatedAt:new Date()}).where(eq(contactSubmissions.id,event.eventId)).catch(()=>undefined)
    throw new SupportError(`Your enquiry was saved (reference ${event.eventId}), but automated delivery is unavailable. Please do not resubmit; contact the team if urgent.`,502,'SUPPORT_DELIVERY_FAILED')
  }
}
