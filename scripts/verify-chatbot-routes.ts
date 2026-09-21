import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { POST } from '../app/api/live-chat/route'

async function main() {
  for(const action of ['products','artwork','delivery','privacy','custom_quote','track_order','human_support']) {
    const result=await POST(new NextRequest('https://alibabasigns.com.au/api/live-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})}))
    assert.equal(result.status,200,action)
    const {data}=await result.json()
    assert.equal(data.intent,action)
    assert.equal(typeof data.response,'string')
    assert.equal(data.collectOrderId,action==='track_order')
  }
  const invalid=await POST(new NextRequest('https://alibabasigns.com.au/api/live-chat',{method:'POST',body:JSON.stringify({action:'execute'})}))
  assert.equal(invalid.status,400)
  console.log('PASS: seven unauthenticated button prompts and invalid-action guard; no webhook or database writes.')
}
main().catch(error=>{console.error(error);process.exitCode=1})
