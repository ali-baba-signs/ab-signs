export const ORDER_STATUSES = [
  'pending_design_confirmation', 'design_revision_required', 'design_confirmed',
  'awaiting_payment', 'payment_confirmed', 'order_confirmed',
  'queued_for_printing', 'printing', 'printing_completed', 'quality_check', 'production_completed',
  'ready_for_pickup', 'ready_for_dispatch', 'dispatched', 'out_for_delivery', 'delivered', 'completed',
  'on_hold', 'cancelled', 'refund_requested', 'refunded',
] as const

export type OrderWorkflowStatus = typeof ORDER_STATUSES[number]
export type OrderMilestone = 'pending' | 'confirmed' | 'production' | 'dispatch' | 'completed' | 'attention'

export const ORDER_MILESTONE_LABELS: Record<OrderMilestone, string> = {
  pending: 'Pending', confirmed: 'Confirmed', production: 'In Production', dispatch: 'Dispatch / Pickup', completed: 'Completed', attention: 'Needs Attention',
}

const statusMilestones: Record<OrderWorkflowStatus, OrderMilestone> = {
  pending_design_confirmation: 'pending', design_revision_required: 'pending', awaiting_payment: 'pending',
  design_confirmed: 'confirmed', payment_confirmed: 'confirmed', order_confirmed: 'confirmed',
  queued_for_printing: 'production', printing: 'production', printing_completed: 'production', quality_check: 'production', production_completed: 'production',
  ready_for_pickup: 'dispatch', ready_for_dispatch: 'dispatch', dispatched: 'dispatch', out_for_delivery: 'dispatch',
  delivered: 'completed', completed: 'completed',
  on_hold: 'attention', cancelled: 'attention', refund_requested: 'attention', refunded: 'attention',
}

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  pending_design_confirmation: 'Pending Design Confirmation',
  design_revision_required: 'Design Revision Required',
  design_confirmed: 'Design Confirmed',
  awaiting_payment: 'Awaiting Payment',
  payment_confirmed: 'Payment Confirmed',
  order_confirmed: 'Order Confirmed',
  queued_for_printing: 'Queued for Printing',
  printing: 'Printing',
  printing_completed: 'Printing Completed',
  quality_check: 'Quality Check',
  production_completed: 'Production Completed',
  ready_for_pickup: 'Ready for Pickup',
  ready_for_dispatch: 'Ready for Dispatch',
  dispatched: 'Dispatched',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  refund_requested: 'Refund Requested',
  refunded: 'Refunded',
}

const transitions: Record<OrderWorkflowStatus, OrderWorkflowStatus[]> = {
  pending_design_confirmation: ['design_confirmed', 'design_revision_required', 'on_hold', 'cancelled'],
  design_revision_required: ['pending_design_confirmation', 'design_confirmed', 'on_hold', 'cancelled'],
  design_confirmed: ['awaiting_payment', 'payment_confirmed', 'on_hold', 'cancelled'],
  awaiting_payment: ['payment_confirmed', 'on_hold', 'cancelled'],
  payment_confirmed: ['order_confirmed', 'refund_requested', 'on_hold'],
  order_confirmed: ['queued_for_printing', 'on_hold', 'cancelled'],
  queued_for_printing: ['printing', 'on_hold'],
  printing: ['printing_completed', 'on_hold'],
  printing_completed: ['quality_check', 'on_hold'],
  quality_check: ['production_completed', 'printing', 'on_hold'],
  production_completed: ['ready_for_pickup', 'ready_for_dispatch', 'on_hold'],
  ready_for_pickup: ['completed', 'on_hold'],
  ready_for_dispatch: ['dispatched', 'on_hold'],
  dispatched: ['out_for_delivery', 'delivered', 'on_hold'],
  out_for_delivery: ['delivered', 'on_hold'],
  delivered: ['completed', 'refund_requested'],
  completed: ['refund_requested'],
  on_hold: [...ORDER_STATUSES.filter((status) => !['on_hold', 'refunded'].includes(status))] as OrderWorkflowStatus[],
  cancelled: ['refund_requested'],
  refund_requested: ['refunded', 'payment_confirmed', 'completed'],
  refunded: [],
}

export function isOrderStatus(value: unknown): value is OrderWorkflowStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderWorkflowStatus)
}

const legacyStatus: Record<string, OrderWorkflowStatus> = {
  pending: 'pending_design_confirmation', confirmed: 'order_confirmed', production: 'printing',
  in_production: 'printing', ready_to_ship: 'ready_for_dispatch', awaiting_dispatch: 'ready_for_dispatch',
  print_ready: 'production_completed', shipped: 'dispatched', awaiting_payment_confirmation: 'awaiting_payment',
}

export function normalizeOrderStatus(status: string): OrderWorkflowStatus {
  return isOrderStatus(status) ? status : legacyStatus[status] || 'pending_design_confirmation'
}
export function orderMilestone(status: string): OrderMilestone { return statusMilestones[normalizeOrderStatus(status)] }
export function orderMilestoneLabel(status: string) { return ORDER_MILESTONE_LABELS[orderMilestone(status)] }
export function allowedTransitions(status: string) { return transitions[normalizeOrderStatus(status)] }
export function assertTransition(current: string, next: unknown) {
  if (!isOrderStatus(next)) throw new Error('Select a valid order status.')
  const normalized = normalizeOrderStatus(current)
  if (!allowedTransitions(normalized).includes(next)) throw new Error(`${ORDER_STATUS_LABELS[normalized]} cannot transition directly to ${ORDER_STATUS_LABELS[next]}.`)
  return next
}
export function designDeadline(createdAt = new Date()) { return new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) }
export function deadlineState(deadline: Date | string | null, confirmedAt?: Date | string | null) {
  if (!deadline) return { delayed: false, remainingMs: null }
  const target = new Date(deadline).getTime()
  const end = confirmedAt ? new Date(confirmedAt).getTime() : Date.now()
  return { delayed: end > target, remainingMs: confirmedAt ? 0 : target - Date.now() }
}
