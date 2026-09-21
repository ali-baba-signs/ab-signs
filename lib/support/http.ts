import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/middleware'
import { processSupportMessage } from '@/lib/support/handler'
import { SupportError, validateSupportMessage } from '@/lib/support/validation'
import { validSupportSecret } from '@/lib/support/security'
import { UploadValidationError, validateUpload } from '@/lib/storage/upload-validation'
import { SvgValidationError, sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'
import { boundedSupportBody } from './request-body'

export const runtime='nodejs'

export async function handleSupportRequest(request:NextRequest,channel=false) {
  try{
    if(channel&&!validSupportSecret(request.headers.get('x-support-channel-secret'),process.env.SUPPORT_CHANNEL_SECRET))throw new SupportError('Channel authentication required.',401,'CHANNEL_AUTH_REQUIRED')
    const origin=request.headers.get('origin')
    if(!channel&&origin&&origin!==new URL(request.url).origin&&origin!==new URL(process.env.NEXT_PUBLIC_SITE_URL||request.url).origin)throw new SupportError('Request origin is not allowed.',403)
    const multipart=request.headers.get('content-type')?.includes('multipart/form-data')
    const maxBytes=multipart?105*1024*1024:32768
    const body=boundedSupportBody(request,maxBytes)
    const form=multipart?await body.formData():null
    let input:Record<string,unknown>
    if(form)input=Object.fromEntries([...form.entries()].filter(([,v])=>typeof v==='string'))
    else {const text=await body.text();if(Buffer.byteLength(text)>maxBytes)throw new SupportError('Support request is too large.',413);try{input=JSON.parse(text)}catch{throw new SupportError('Invalid support request.')}}
    if(!input||typeof input!=='object'||Array.isArray(input))throw new SupportError('Invalid support request.')
    if(input.website)return NextResponse.json({data:{message:'Message received.'}},{status:201})
    const source=channel?input.source:'Website'
    if(!['Website','Facebook','WhatsApp'].includes(String(source)))throw new SupportError('Invalid message source.')
    const category=input.category||input.enquiryType
    const message=validateSupportMessage({...input,customerName:input.customerName??input.name,customerEmail:input.customerEmail??input.email,category:category==='Custom quotation'?'Custom quote':category},source as 'Website'|'Facebook'|'WhatsApp')
    let artwork: {filename:string;contentType:string;content:Buffer}|undefined
    const file=form?.get('artwork')
    if(file instanceof File&&file.size){
      if(message.category!=='Custom quote')throw new SupportError('Artwork can only accompany a custom quote.')
      const extension=file.name.split('.').pop()?.toLowerCase()||''
      const types:Record<string,string>={pdf:'application/pdf',svg:'image/svg+xml',png:'image/png',eps:'application/postscript',ai:'application/vnd.adobe.illustrator'}
      const contentType=file.type||types[extension]||''
      validateUpload({filename:file.name,contentType,size:file.size,purpose:'design-artwork'})
      const content=Buffer.from(await file.arrayBuffer())
      const pdf=content.subarray(0,5).toString()==='%PDF-', ps=content.subarray(0,20).toString().startsWith('%!PS-Adobe')
      if(extension==='pdf'&&!pdf||extension==='png'&&content.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||extension==='eps'&&!ps||extension==='ai'&&!pdf&&!ps)throw new SupportError('Artwork file signature is invalid.')
      const safeContent=contentType==='image/svg+xml'?Buffer.from(sanitizeSvgMarkup(content.toString('utf8'))):content
      artwork={filename:file.name.slice(0,255),contentType,content:safeContent}
    }
    const session=channel?null:await getSession(request)
    const data=await processSupportMessage(message,request,session?.user?{id:session.user.id,email:session.user.email,emailVerified:session.user.emailVerified}:null,artwork)
    return NextResponse.json({data},{status:201,headers:{'cache-control':'no-store'}})
  }catch(caught){
    const error = caught instanceof UploadValidationError || caught instanceof SvgValidationError ? new SupportError(caught.message) : caught
    const known=error instanceof SupportError
    if(!known)console.error('Support request failed', {type:error instanceof Error?error.name:'Unknown'})
    return NextResponse.json({error:{code:known?error.code:'SUPPORT_UNAVAILABLE',message:known?error.message:'Support is temporarily unavailable. Please contact us directly.'}},{status:known?error.status:503,headers:{'cache-control':'no-store'}})
  }
}
export async function POST(request:NextRequest){return handleSupportRequest(request)}
