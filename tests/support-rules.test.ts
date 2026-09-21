import test from 'node:test'
import assert from 'node:assert/strict'
import { CHAT_ACTIONS, notificationPolicy, ruleReply, supportIntent } from '../lib/support/rules'

test('all button actions return the required structured response', () => {
  for(const {action} of CHAT_ACTIONS) {
    const reply=ruleReply(supportIntent(action))
    assert.deepEqual(Object.keys(reply),['intent','response','requiresHuman','collectOrderId','notifyTeam'])
    assert.equal(reply.intent,action)
    assert.ok(reply.response.length)
  }
})
test('normal FAQs and tracking never trigger customer or team email', () => {
  for(const intent of ['products','artwork','delivery','privacy','track_order','unknown'] as const)assert.deepEqual(notificationPolicy(intent),{notifyTeam:false,customerEmail:false})
  assert.equal(ruleReply('track_order').collectOrderId,true)
  assert.match(ruleReply('artwork').response,/PDF, SVG, EPS, AI and PNG/)
  assert.match(ruleReply('artwork').response,/100 MB/)
  assert.match(ruleReply('delivery').response,/Australia wide/)
})
test('escalation matrix limits customer emails to quotes, payments and humans', () => {
  for(const intent of ['custom_quote','payment','human_support'] as const)assert.deepEqual(notificationPolicy(intent),{notifyTeam:true,customerEmail:true})
  for(const intent of ['complaint','urgent'] as const)assert.deepEqual(notificationPolicy(intent),{notifyTeam:true,customerEmail:false})
})
test('rule classification supports explicit actions and deterministic text fallbacks', () => {
  assert.equal(supportIntent('artwork','payment'),'artwork')
  assert.equal(supportIntent(undefined,'I have a payment issue'),'payment')
  assert.equal(supportIntent(undefined,'My order is damaged'),'complaint')
  assert.equal(supportIntent(undefined,'This is urgent'),'urgent')
  assert.equal(supportIntent(undefined,'Please help','Human request'),'human_support')
  assert.equal(supportIntent(undefined,'hello'),'unknown')
  for(const path of ['/policies','/privacy-policy','/terms-of-service','/refund-returns-policy','/warranty-disclaimer'])assert.ok(ruleReply('privacy').response.includes(path))
})
