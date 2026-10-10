export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'production',
  'ready_to_ship',
  'shipped',

  'pending_design_confirmation',
  'design_revision_required',
  'design_confirmed',
  'artwork_pending',

  'awaiting_payment_confirmation',
  'awaiting_payment',
  'payment_confirmed',
  'order_confirmed',

  'in_production',
  'quality_check',
  'printing_completed',
  'production_completed',
  'print_ready',

  'ready_for_pickup',
  'awaiting_dispatch',
  'out_for_delivery',

  'delivered',
  'completed',

  'on_hold',
  'cancelled',
  'refund_requested',
  'refunded',

  'dispatched',
] as const


export type OrderWorkflowStatus =
  (typeof ORDER_STATUSES)[number]



export type OrderMilestone =
  | 'pending'
  | 'confirmed'
  | 'production'
  | 'dispatch'
  | 'completed'
  | 'attention'



export const ORDER_MILESTONE_LABELS = {

pending:
'Pending / Design',

confirmed:
'Confirmed',

production:
'Production',

dispatch:
'Dispatch / Pickup',

completed:
'Completed',

attention:
'Needs Attention',

} satisfies Record<OrderMilestone,string>





const statusMilestones:
Record<OrderWorkflowStatus,OrderMilestone> = {


pending:
'pending',

artwork_pending:
'pending',

pending_design_confirmation:
'pending',

design_revision_required:
'pending',



confirmed:
'confirmed',

design_confirmed:
'confirmed',

awaiting_payment:
'confirmed',

awaiting_payment_confirmation:
'confirmed',

payment_confirmed:
'confirmed',

order_confirmed:
'confirmed',



production:
'production',

in_production:
'production',

quality_check:
'production',

printing_completed:
'production',

production_completed:
'production',

print_ready:
'production',



ready_to_ship:
'dispatch',

ready_for_pickup:
'dispatch',

awaiting_dispatch:
'dispatch',

shipped:
'dispatch',

dispatched:
'dispatch',

out_for_delivery:
'dispatch',



delivered:
'completed',

completed:
'completed',



on_hold:
'attention',

cancelled:
'attention',

refund_requested:
'attention',

refunded:
'attention',

}