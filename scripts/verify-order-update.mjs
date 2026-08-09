import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
const transitions = {
  pending_design_confirmation: 'design_confirmed', design_revision_required: 'pending_design_confirmation', design_confirmed: 'awaiting_payment_confirmation',
  awaiting_payment_confirmation: 'payment_confirmed', payment_confirmed: 'order_confirmed', order_confirmed: 'in_production', in_production: 'quality_check',
  quality_check: 'print_ready', print_ready: 'awaiting_dispatch', awaiting_dispatch: 'out_for_delivery', out_for_delivery: 'delivered', delivered: 'completed',
  on_hold: 'pending_design_confirmation', cancelled: 'refund_requested', refund_requested: 'refunded', pending: 'pending_design_confirmation', confirmed: 'in_production',
  production: 'quality_check', ready_to_ship: 'out_for_delivery', shipped: 'delivered',
}
try {
  const { rows } = await client.query("select * from orders where status::text <> all(array['completed','refunded']) order by created_at desc limit 1")
  if (!rows[0]) { console.log('Order update verification skipped: there are no transitionable orders.'); process.exit(0) }
  const order = rows[0]
  const next = transitions[order.status]
  if (!next) { console.log(`Order update verification skipped: no safe test transition from ${order.status}.`); process.exit(0) }
  await client.query('begin')
  const updated = await client.query(`update orders set status=$1,payment_status=$2,design_confirmed_at=$3,design_confirmation_on_time=$4,receipt_asset_id=$5,expected_printing_at=$6,expected_delivery_at=$7,updated_at=now() where id=$8 returning id,status,payment_status`, [next, 'paid', next === 'design_confirmed' ? new Date().toISOString() : order.design_confirmed_at, order.design_confirmation_on_time, order.receipt_asset_id, order.expected_printing_at, order.expected_delivery_at, order.id])
  await client.query('insert into order_status_history(order_id,status,previous_status,new_status,notes) values($1,$2,$3,$2,$4)', [order.id,next,order.status,'Rollback-only verification'])
  const history = await client.query('select count(*)::int count from order_status_history where order_id=$1 and notes=$2',[order.id,'Rollback-only verification'])
  if (updated.rowCount !== 1 || history.rows[0].count !== 1) throw new Error('The update or status-history insert did not persist inside the test transaction.')
  await client.query('rollback')
  console.log(`Order update verification passed for ${order.order_number}: ${order.status} -> ${next}, payment -> paid, history inserted, transaction rolled back.`)
} catch (error) {
  await client.query('rollback').catch(()=>undefined)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.release(); await pool.end()
}
