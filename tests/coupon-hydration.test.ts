import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import CouponsClient from '../app/admin/coupons/CouponsClient'

test('coupon manager produces deterministic server markup', () => {
  const firstRender = renderToString(React.createElement(CouponsClient))
  const secondRender = renderToString(React.createElement(CouponsClient))

  assert.equal(firstRender, secondRender)
  assert.equal((firstRender.match(/type="submit"/g) ?? []).length, 2)
  assert.ok(firstRender.includes('Create coupon'))
  assert.ok(firstRender.includes('Create offer'))
  assert.ok(firstRender.includes('data-slot="input"'))
})
