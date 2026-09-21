'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { SupportSettings } from '@/lib/support/settings'

export function SupportSettingsPanel({value,onChange}:{value:SupportSettings;onChange:(value:SupportSettings)=>void}){
  const set=<K extends keyof SupportSettings>(key:K,next:SupportSettings[K])=>onChange({...value,[key]:next})
  return <section id="support-settings" className="rounded-xl border bg-card p-4 sm:p-6">
    <h2 className="text-xl font-bold">Support Settings</h2>
    <p className="mt-2 text-sm text-muted-foreground">Support enquiries are saved in the enquiries inbox and sent to n8n. Customer acknowledgements and team notification emails are sent by n8n.</p>
    <h3 className="mt-6 font-semibold">Business Hours</h3>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.businessHoursEnabled} onChange={e=>set('businessHoursEnabled',e.target.checked)}/>Enable business hours</label>
    <p className="mt-1 text-xs text-muted-foreground">When disabled, the during-hours response is always used. Closing time is exclusive; overnight hours continue into the next day.</p>
    <label className="mt-4 block text-sm font-semibold">Timezone<Input required value={value.timezone} onChange={e=>set('timezone',e.target.value)} placeholder="Australia/Melbourne"/></label>
    <fieldset className="mt-4"><legend className="text-sm font-semibold">Opening days</legend><div className="mt-2 flex flex-wrap gap-4">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,index)=><label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={value.openingDays.includes(index)} onChange={e=>set('openingDays',e.target.checked?[...value.openingDays,index]:value.openingDays.filter(d=>d!==index))}/>{day}</label>)}</div></fieldset>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Opening time<Input required type="time" value={value.openingTime} onChange={e=>set('openingTime',e.target.value)}/></label><label className="text-sm font-semibold">Closing time<Input required type="time" value={value.closingTime} onChange={e=>set('closingTime',e.target.value)}/></label></div>
    <h3 className="mt-6 font-semibold">Auto Reply Messages</h3>
    <label className="mt-3 block text-sm font-semibold">During business hours<textarea required maxLength={2000} className="mt-2 min-h-24 w-full rounded border bg-background p-3" value={value.businessHoursResponse} onChange={e=>set('businessHoursResponse',e.target.value)}/></label>
    <label className="mt-3 block text-sm font-semibold">Outside business hours<textarea required maxLength={2000} className="mt-2 min-h-24 w-full rounded border bg-background p-3" value={value.afterHoursResponse} onChange={e=>set('afterHoursResponse',e.target.value)}/></label>
    <h3 className="mt-6 font-semibold">Support Notification Settings</h3>
    <p className="mt-1 text-sm text-muted-foreground">Team notification emails receive new enquiries, custom quotes and important support alerts through n8n. Add at least one recipient before enabling the workflow.</p>
    <div className="mt-3 space-y-2">{value.notificationEmails.map((email,index)=><div key={index} className="flex gap-2"><Input required type="email" aria-label={`Support notification email ${index+1}`} value={email} onChange={e=>set('notificationEmails',value.notificationEmails.map((v,i)=>i===index?e.target.value:v))}/><Button type="button" variant="outline" onClick={()=>set('notificationEmails',value.notificationEmails.filter((_,i)=>i!==index))}>Remove</Button></div>)}</div>
    <Button className="mt-3" type="button" variant="outline" disabled={value.notificationEmails.length>=20} onClick={()=>set('notificationEmails',[...value.notificationEmails,''])}>Add notification email</Button>
    <h3 className="mt-6 font-semibold">n8n integration</h3>
    <label className="mt-3 block text-sm font-semibold">Webhook URL<Input type="url" value={value.webhookUrl} onChange={e=>set('webhookUrl',e.target.value)} placeholder="https://automation.alibabasigns.com.au/webhook/support-message"/></label>
    <p className="mt-2 text-xs text-muted-foreground">Leave blank to use the deployment environment or the default support webhook. The server environment takes precedence. Configure webhook secrets and allowed hostnames on the server; never place credentials in this URL.</p>
  </section>
}
