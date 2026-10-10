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
] as const

export type OrderWorkflowStatus = (typeof ORDER_STATUSES)[number]

// Streamlined milestones: Design & Confirmation -> Production -> Dispatch -> Completed -> Attention
export type OrderMilestone = 'pending' | 'production' | 'dispatch' | 'completed' | 'attention'

export const ORDER_MILESTONE_LABELS: Record<OrderMilestone, string> = {
  pending: 'Pending / Design',
  production: 'In Production',
  dispatch: 'Dispatch / Pickup',
  completed: 'Completed',
  attention: 'Needs Attention',
}

// Keeping order_confirmed in 'pending' ensures it appears alongside design actions in milestone filters
const statusMilestones: Record<OrderWorkflowStatus, OrderMilestone> = {
  pending: 'pending',
  artwork_pending: 'pending',
  pending_design_confirmation: 'pending',
  design_revision_required: 'pending',
  confirmed: 'pending',
  design_confirmed: 'pending',
  awaiting_payment_confirmation: 'pending',
  awaiting_payment: 'pending',
  payment_confirmed: 'pending',
  order_confirmed: 'pending',
  production: 'production',
  in_production: 'production',
  printing_completed: 'production',
  production_completed: 'production',
  print_ready: 'production',
  ready_to_ship: 'dispatch',
  ready_for_pickup: 'dispatch',
  awaiting_dispatch: 'dispatch',
  shipped: 'dispatch',
  out_for_delivery: 'dispatch',
  delivered: 'completed',
  completed: 'completed',
  on_hold: 'attention',
  cancelled: 'attention',
  refund_requested: 'attention',
  refunded: 'attention',
}

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  production: 'Production',
  ready_to_ship: 'Ready to Ship',
  shipped: 'Shipped',
  pending_design_confirmation: 'Awaiting Artwork / Pending Design',
  design_revision_required: 'Design Revision Required',
  design_confirmed: 'Design Confirmed',
  artwork_pending: 'Artwork Pending',
  awaiting_payment_confirmation: 'Awaiting Payment Confirmation',
  awaiting_payment: 'Awaiting Payment',
  payment_confirmed: 'Payment Confirmed',
  order_confirmed: 'Order Confirmed',
  in_production: 'In Production',
  printing_completed: 'Printing Completed',
  production_completed: 'Production Completed',
  print_ready: 'Printing Completed',
  ready_for_pickup: 'Ready for Pickup',
  awaiting_dispatch: 'Awaiting Dispatch',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  refund_requested: 'Refund Requested',
  refunded: 'Refunded',
}

const transitions: Record<OrderWorkflowStatus, readonly OrderWorkflowStatus[]> = {
  // From pending design, admins can request revision, confirm order directly, or hold/cancel
  pending_design_confirmation: ['order_confirmed', 'design_revision_required', 'artwork_pending', 'design_confirmed', 'on_hold', 'cancelled'],
  design_revision_required: ['order_confirmed', 'pending_design_confirmation', 'design_confirmed', 'on_hold', 'cancelled'],
  artwork_pending: ['pending_design_confirmation', 'design_confirmed', 'order_confirmed', 'on_hold', 'cancelled'],
  design_confirmed: ['awaiting_payment', 'payment_confirmed', 'order_confirmed'],
  awaiting_payment_confirmation: ['payment_confirmed', 'order_confirmed', 'cancelled'],
  awaiting_payment: ['payment_confirmed', 'order_confirmed', 'cancelled'],
  payment_confirmed: ['order_confirmed', 'in_production'],

  // Once confirmed, moves to production
  order_confirmed: ['in_production', 'print_ready', 'on_hold', 'cancelled'],

  // Production steps
  in_production: ['print_ready', 'on_hold'],
  production: ['in_production', 'print_ready'],
  printing_completed: ['production_completed', 'print_ready'],
  production_completed: ['print_ready'],
  print_ready: ['ready_for_pickup', 'out_for_delivery', 'on_hold'],

  // Dispatch & final steps
  ready_for_pickup: ['completed', 'out_for_delivery', 'delivered', 'on_hold'],
  ready_to_ship: ['awaiting_dispatch', 'out_for_delivery'],
  awaiting_dispatch: ['out_for_delivery'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered', 'on_hold'],
  delivered: ['completed', 'refund_requested', 'refunded'],
  completed: ['refund_requested', 'refunded'],
  refund_requested: ['refunded'],

  on_hold: ORDER_STATUSES.filter(
    (status): status is Exclude<OrderWorkflowStatus, 'on_hold' | 'refunded'> =>
      status !== 'on_hold' && status !== 'refunded'
  ),
  cancelled: ['refunded'],
  refunded: [],
  pending: ['pending_design_confirmation'],
  confirmed: ['order_confirmed'],
}

export function isOrderStatus(value: unknown): value is OrderWorkflowStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

const legacyStatus: Record<string, OrderWorkflowStatus> = {
  quality_check: 'in_production',
  dispatched: 'out_for_delivery',
}

export function normalizeOrderStatus(status?: string | null): OrderWorkflowStatus {
  if (isOrderStatus(status)) return status
  return status ? legacyStatus[status] || 'pending_design_confirmation' : 'pending_design_confirmation'
}

export function orderMilestone(status: string): OrderMilestone {
  return statusMilestones[normalizeOrderStatus(status)]
}

export function orderMilestoneLabel(status: string): string {
  return ORDER_MILESTONE_LABELS[orderMilestone(status)]
}

export function allowedTransitions(status: string): readonly OrderWorkflowStatus[] {
  return transitions[normalizeOrderStatus(status)]
}

/**
 * Helper for UI components/dropdowns:
 * Returns the exact list of options (with value and label) available for the current status.
 */
export function getAvailableNextStatuses(currentStatus: string): { value: OrderWorkflowStatus; label: string }[] {
  const allowed = allowedTransitions(currentStatus)
  return allowed.map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  }))
}

export function assertTransition(current: string, next: unknown): OrderWorkflowStatus {
  if (!isOrderStatus(next)) {
    throw new Error('Select a valid order status.')
  }

  const normalizedCurrent = normalizeOrderStatus(current)
  if (!allowedTransitions(normalizedCurrent).includes(next)) {
    throw new Error(
      `${ORDER_STATUS_LABELS[normalizedCurrent]} cannot transition directly to ${ORDER_STATUS_LABELS[next]}.`
    )
  }
  return next
}

export function designDeadline(createdAt = new Date()): Date {
  return new Date(createdAt.getTime() + 6 * 60 * 60 * 1000)
}

export function deadlineState(
  deadline: Date | string | null,
  confirmedAt?: Date | string | null
): { delayed: boolean; remainingMs: number | null } {
  if (!deadline) return { delayed: false, remainingMs: null }
  const target = new Date(deadline).getTime()
  const end = confirmedAt ? new Date(confirmedAt).getTime() : Date.now()
  return { delayed: end > target, remainingMs: confirmedAt ? 0 : target - Date.now() }
}
