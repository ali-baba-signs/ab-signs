export const ORDER_STATUSES = [
  'pending_design_confirmation', 'design_revision_required', 'design_confirmed', 'awaiting_payment_confirmation',
  'payment_confirmed', 'order_confirmed', 'in_production', 'quality_check', 'print_ready', 'ready_for_pickup',
  'awaiting_dispatch', 'out_for_delivery', 'delivered', 'completed', 'on_hold', 'cancelled', 'refund_requested', 'refunded',
] as const
export type OrderWorkflowStatus = typeof ORDER_STATUSES[number]
export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  pending_design_confirmation: 'Pending Design Confirmation', design_revision_required: 'Design Revision Required', design_confirmed: 'Design Confirmed',
  awaiting_payment_confirmation: 'Awaiting Payment Confirmation', payment_confirmed: 'Payment Confirmed', order_confirmed: 'Order Confirmed',
  in_production: 'In Production', quality_check: 'Quality Check', print_ready: 'Print Ready', ready_for_pickup: 'Ready for Pickup',
  awaiting_dispatch: 'Awaiting Dispatch', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', completed: 'Completed',
  on_hold: 'On Hold', cancelled: 'Cancelled', refund_requested: 'Refund Requested', refunded: 'Refunded',
}
const transitions: Record<OrderWorkflowStatus, OrderWorkflowStatus[]> = {
  pending_design_confirmation: ['design_confirmed','design_revision_required','on_hold','cancelled'],
  design_revision_required: ['pending_design_confirmation','on_hold','cancelled'],
  design_confirmed: ['awaiting_payment_confirmation','payment_confirmed','on_hold','cancelled'],
  awaiting_payment_confirmation: ['payment_confirmed','on_hold','cancelled'],
  payment_confirmed: ['order_confirmed','refund_requested','on_hold'], order_confirmed: ['in_production','on_hold','cancelled'],
  in_production: ['quality_check','on_hold'], quality_check: ['print_ready','in_production','on_hold'],
  print_ready: ['ready_for_pickup','awaiting_dispatch','on_hold'], ready_for_pickup: ['completed','on_hold'],
  awaiting_dispatch: ['out_for_delivery','on_hold'], out_for_delivery: ['delivered','on_hold'], delivered: ['completed','refund_requested'],
  completed: ['refund_requested'], on_hold: ['pending_design_confirmation','design_confirmed','awaiting_payment_confirmation','payment_confirmed','order_confirmed','in_production','quality_check','print_ready','awaiting_dispatch','cancelled'],
  cancelled: ['refund_requested'], refund_requested: ['refunded','payment_confirmed','completed'], refunded: [],
}
export function isOrderStatus(value: unknown): value is OrderWorkflowStatus { return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderWorkflowStatus) }
const legacyStatus: Record<string, OrderWorkflowStatus> = { pending: 'pending_design_confirmation', confirmed: 'order_confirmed', production: 'in_production', ready_to_ship: 'awaiting_dispatch', shipped: 'out_for_delivery' }
export function normalizeOrderStatus(status: string) { return isOrderStatus(status) ? status : legacyStatus[status] || 'pending_design_confirmation' }
export function allowedTransitions(status: string) { return transitions[normalizeOrderStatus(status)] }
export function assertTransition(current: string, next: unknown) { if (!isOrderStatus(next)) throw new Error('Select a valid order status.'); const normalized = normalizeOrderStatus(current); if (!allowedTransitions(normalized).includes(next)) throw new Error(`${ORDER_STATUS_LABELS[normalized]} cannot transition directly to ${ORDER_STATUS_LABELS[next]}.`); return next }
export function designDeadline(createdAt = new Date()) { return new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) }
export function deadlineState(deadline: Date | string | null, confirmedAt?: Date | string | null) { if (!deadline) return { delayed: false, remainingMs: null }; const target = new Date(deadline).getTime(); const end = confirmedAt ? new Date(confirmedAt).getTime() : Date.now(); return { delayed: end > target, remainingMs: confirmedAt ? 0 : target - Date.now() } }
