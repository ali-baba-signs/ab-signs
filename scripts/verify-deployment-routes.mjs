import assert from 'node:assert/strict'
const base = process.env.SMOKE_BASE_URL || 'http://localhost:3103'
async function json(path, expected=200) { const response = await fetch(base + path, {signal:AbortSignal.timeout(20000)}); assert.equal(response.status,expected,path); return response.json() }
const { data: {products} } = await json('/api/products?limit=100')
let selections = 0
for (const product of products) {
  for (const size of product.sizes.filter(s=>s.enabled)) {
    for (const config of size.designConfigurations.filter(c=>c.enabled)) {
      const templateId = config.designType === 'single_side' ? config.singleTemplateId : config.frontTemplateId
      if (!templateId) continue
      const params = new URLSearchParams({productId:product.id,sizeId:size.id,designType:config.designType})
      const listing = await json('/api/templates?' + params)
      assert.deepEqual(listing.data.templates.map(t=>t.id),[templateId])
      assert.ok(listing.data.templates.every(t=>t.previewUrl.startsWith('https://assets.alibabasigns.com.au/')))
      const editor = await json(`/api/templates/${templateId}/editor-data?${params}`)
      assert.equal(editor.data.productSize.id,size.id)
      assert.equal(editor.data.productId,product.id)
      assert.ok(editor.data.template.canvasData.objects.length)
      if(config.designType==='double_side') assert.equal(editor.data.backTemplate.id,config.backTemplateId)
      selections++
    }
  }
}
const settings = (await json('/api/store/settings')).data
assert.equal(typeof settings.taxEnabled,'boolean')
assert.ok(settings.taxName)
assert.ok(settings.bannerShippingBands.length)
await json('/api/designs',401)
await json('/api/admin/settings',401)
for(const path of ['/products','/design','/checkout','/payment','/sign-in']) { const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)}); assert.equal(response.status,200,path) }
console.log(JSON.stringify({pass:true,products:products.length,sizeTemplateSelections:selections,protectedRoutes:'401 without session',publicPages:5,taxSettings:'present',shippingTiers:settings.bannerShippingBands.length}))
