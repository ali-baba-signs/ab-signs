'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Minimize2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CHAT_ACTIONS, type ChatReply, type SupportIntent } from '@/lib/support/rules'

interface Message { id: string; text: string; sender: 'user'|'support' }
const policyLinks=['/policies','/privacy-policy','/terms-of-service','/refund-returns-policy','/warranty-disclaimer']
export function ChatWidget() {
  const [isOpen,setIsOpen]=useState(false)
  const [messages,setMessages]=useState<Message[]>([])
  const [input,setInput]=useState('')
  const [reply,setReply]=useState<ChatReply|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const sessionId=useRef('')
  const inFlight=useRef(false)
  useEffect(()=>{
    if(!isOpen)return
    const controller=new AbortController()
    const poll=async()=>{
      if(!sessionId.current)return
      try {
        const response=await fetch(`/api/live-chat?sessionId=${sessionId.current}`,{signal:controller.signal})
        if(!response.ok)return
        const payload=await response.json()
        const incoming:Message[]=(payload.data?.messages||[]).map((row:{id:string;message:string;isAdminMessage:boolean})=>({id:row.id,text:row.message,sender:row.isAdminMessage?'support':'user'}))
        if(!controller.signal.aborted)setMessages(current=>[...current,...incoming.filter(row=>!current.some(item=>item.id===row.id))])
      }catch{/* Retry on the next poll while the chat remains open. */}
    }
    const timer=window.setInterval(()=>void poll(),10000)
    return ()=>{controller.abort();window.clearInterval(timer)}
  },[isOpen])
  async function send(action?:SupportIntent) {
    if(inFlight.current||(!action&&!input.trim()))return
    inFlight.current=true;setBusy(true);setError('')
    const message=action?'':input.trim()
    const selected=action||(reply?.collectOrderId?'track_order':reply?.requiresHuman&&reply.intent!=='custom_quote'?reply.intent:undefined)
    try {
      if(!sessionId.current)sessionId.current=crypto.randomUUID()
      const response=await fetch('/api/live-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:selected,message,orderNumber:!action&&reply?.collectOrderId?message:undefined,sessionId:sessionId.current,pageUrl:window.location.origin+window.location.pathname})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error?.message||'Support is unavailable.')
      const next=payload.data as ChatReply
      setReply(next)
      const saved=payload.data.messages as {id:string;message:string;isAdminMessage:boolean}[]|undefined
      const additions:Message[]=saved?saved.map(row=>({id:row.id,text:row.message,sender:row.isAdminMessage?'support':'user'})):[{id:crypto.randomUUID(),text:action?CHAT_ACTIONS.find(item=>item.action===action)?.label||action:message,sender:'user'},{id:crypto.randomUUID(),text:next.response,sender:'support'}]
      setMessages(current=>[...current,...additions.filter(row=>!current.some(item=>item.id===row.id))])
      setInput('')
    }catch(error){setError(error instanceof Error?error.message:'Support is unavailable.')}
    finally{inFlight.current=false;setBusy(false)}
  }
  if(!isOpen)return <button aria-label="Open support chat" onClick={()=>setIsOpen(true)} className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg"><MessageCircle className="h-6 w-6"/></button>
  return <section aria-label="Support chat" className="fixed bottom-3 right-3 z-40 flex h-[min(640px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-96 flex-col overflow-hidden rounded-lg border bg-background shadow-xl sm:bottom-6 sm:right-6">
    <header className="flex items-center justify-between border-b bg-card p-4"><div><h2 className="font-semibold">Alibaba Signs Support</h2><p className="text-xs text-muted-foreground">Instant FAQs · Team replies during business hours</p></div><button aria-label="Minimize support chat" onClick={()=>setIsOpen(false)}><Minimize2 className="h-5 w-5"/></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-sm">How can we help?</p>
      <div className="mb-4 flex flex-wrap gap-2">{CHAT_ACTIONS.map(item=><Button key={item.action} variant="outline" size="sm" disabled={busy} onClick={()=>void send(item.action)}>{item.label}</Button>)}</div>
      <div role="log" aria-live="polite" className="space-y-3">{messages.map(message=><p key={message.id} className={`break-words rounded-lg p-3 text-sm whitespace-pre-wrap ${message.sender==='user'?'ml-6 bg-primary text-white':'mr-3 bg-secondary'}`}>{message.text}</p>)}</div>
      {reply?.intent==='privacy'&&<ul className="mt-3 space-y-2 text-sm">{policyLinks.map(path=><li key={path}><Link className="underline" href={path}>{path}</Link></li>)}</ul>}
      {reply?.intent==='products'&&<Link className="mt-3 block text-sm underline" href="/products">Browse products</Link>}
      {reply?.requiresHuman&&<Link className="mt-3 block text-sm underline" href="/contact">{reply.intent==='custom_quote'?'Submit quote details and artwork':'Contact the support team'}</Link>}
    </div>
    <form onSubmit={event=>{event.preventDefault();void send()}} className="space-y-2 border-t bg-card p-3">
      <label className="text-xs font-semibold" htmlFor="support-chat-input">{reply?.collectOrderId?'Order ID':'Your message'}</label>
      <div className="flex gap-2"><Input id="support-chat-input" className="min-w-0" maxLength={reply?.collectOrderId?80:2000} value={input} onChange={event=>setInput(event.target.value)} disabled={busy} placeholder={reply?.collectOrderId?'Enter your order ID':'Type a question...'}/><Button type="submit" aria-label="Send support message" disabled={busy||!input.trim()}><Send className="h-4 w-4"/></Button></div>
      {error&&<p role="alert" className="text-xs text-red-700">{error} <Link href="/sign-in" className="underline">Sign in</Link></p>}
      <p className="text-xs text-muted-foreground">FAQs need no sign-in. Private tracking and team requests require sign-in.</p>
    </form>
  </section>
}
