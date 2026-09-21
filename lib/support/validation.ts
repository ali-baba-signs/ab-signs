import { SUPPORT_CATEGORIES, type SupportCategory, type SupportSource, validEmail } from './settings'
import { CHAT_ACTIONS } from './rules'
export class SupportError extends Error { constructor(message:string, public status=400, public code='INVALID_SUPPORT_MESSAGE'){super(message)} }
export interface SupportMessage {
  action?: string
  subject:string;customerName:string;customerEmail:string;phone:string;category:SupportCategory;message:string;pageUrl:string;source:SupportSource;orderNumber:string;company:string
  quote: {product:string;size:string;quantity:number;requiredDate:string;notes:string} | null
}
export function validateSupportMessage(value: unknown, source: SupportSource = 'Website'): SupportMessage {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new SupportError('Enter a valid support message.')
  const input=value as Record<string,unknown>
  function text(key:string,max:number,min=0){const raw=input[key];if(raw!==undefined&&typeof raw!=='string')throw new SupportError(`${key} is invalid.`);const result=String(raw||'').trim();if(result.length<min||result.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result))throw new SupportError(`${key} must contain ${min}–${max} characters.`);return result}
  const customerName=text('customerName',255,2),customerEmail=text('customerEmail',254,3).toLowerCase(),phone=text('phone',30),message=text('message',5000,10)
  if(!validEmail(customerEmail))throw new SupportError('Enter a valid email address.')
  if(phone&&!/^[+()\-\s0-9]{6,30}$/.test(phone))throw new SupportError('Enter a valid phone number or leave it blank.')
  const category=text('category',80) as SupportCategory
  if(!SUPPORT_CATEGORIES.includes(category))throw new SupportError('Select a valid support category.')
  const orderNumber=text('orderNumber',80)
  if(category==='Order status'&&!orderNumber)throw new SupportError('Order number and customer email are required.')
  let pageUrl=text('pageUrl',2000)
  if(pageUrl){try{const url=new URL(pageUrl);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();pageUrl=url.origin+url.pathname}catch{throw new SupportError('Page URL is invalid.')}}
  let quote:SupportMessage['quote']=null
  if(category==='Custom quote') {
    const quantity=Number(input.quantity)
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw new SupportError('Quote quantity must be between 1 and 1000000.')
    const requiredDate=text('requiredDate',10)
    if(requiredDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(requiredDate)||Number.isNaN(Date.parse(requiredDate))||new Date(requiredDate).toISOString().slice(0,10)!==requiredDate))throw new SupportError('Required date is invalid.')
    quote={product:text('product',255,2),size:text('size',255,1),quantity,requiredDate,notes:message}
  }
  const action = text('action',40)
  if(action && ![...CHAT_ACTIONS.map(item=>String(item.action)), 'payment', 'complaint', 'urgent'].includes(action))throw new SupportError('Invalid support action.')
  return {action:action||undefined,subject:text('subject',255),customerName,customerEmail,phone,category,message,pageUrl,source,orderNumber,company:text('company',255),quote}
}
