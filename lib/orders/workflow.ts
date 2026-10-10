export const ORDER_STATUSES = [
  'pending_design_confirmation',
  'design_revision_required',
  'order_confirmed',
  'in_production',
  'print_ready',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'completed',
  'on_hold',
  'cancelled',
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
  pending_design_confirmation: 'pending',
  design_revision_required: 'pending',
  order_confirmed: 'pending', // Belongs to the design & confirmation stage
  in_production: 'production',
  print_ready: 'production',
  ready_for_pickup: 'dispatch',
  out_for_delivery: 'dispatch',
  delivered: 'completed',
  completed: 'completed',
  on_hold: 'attention',
  cancelled: 'attention',
  refunded: 'attention',
}

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  pending_design_confirmation: 'Awaiting Artwork / Pending Design',
  design_revision_required: 'Design Revision Required',
  order_confirmed: 'Order Confirmed',
  in_production: 'In Production',
  print_ready: 'Printing Completed',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const transitions: Record<OrderWorkflowStatus, readonly OrderWorkflowStatus[]> = {
  // From pending design, admins can request revision, confirm order directly, or hold/cancel
  pending_design_confirmation: ['order_confirmed', 'design_revision_required', 'on_hold', 'cancelled'],
  design_revision_required: ['order_confirmed', 'pending_design_confirmation', 'on_hold', 'cancelled'],

  // Once confirmed, moves to production
  order_confirmed: ['in_production', 'print_ready', 'on_hold', 'cancelled'],

  // Production steps
  in_production: ['print_ready', 'on_hold'],
  print_ready: ['ready_for_pickup', 'out_for_delivery', 'on_hold'],

  // Dispatch & final steps
  ready_for_pickup: ['completed', 'out_for_delivery', 'delivered', 'on_hold'],
  out_for_delivery: ['delivered', 'on_hold'],
  delivered: ['completed', 'refunded'],
  completed: ['refunded'],

  on_hold: ORDER_STATUSES.filter(
    (status): status is Exclude<OrderWorkflowStatus, 'on_hold' | 'refunded'> =>
      status !== 'on_hold' && status !== 'refunded'
  ),
  cancelled: ['refunded'],
  refunded: [],
}

export function isOrderStatus(value: unknown): value is OrderWorkflowStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

const legacyStatus: Record<string, OrderWorkflowStatus> = {
  pending: 'pending_design_confirmation',
  artwork_pending: 'pending_design_confirmation',
  awaiting_payment: 'pending_design_confirmation',
  awaiting_payment_confirmation: 'pending_design_confirmation',
  design_confirmed: 'order_confirmed',
  payment_confirmed: 'order_confirmed',
  confirmed: 'order_confirmed',
  production: 'in_production',
  quality_check: 'in_production',
  printing_completed: 'print_ready',
  production_completed: 'print_ready',
  ready_to_ship: 'ready_for_pickup',
  awaiting_dispatch: 'ready_for_pickup',
  shipped: 'out_for_delivery',
  refund_requested: 'refunded',
}

export function normalizeOrderStatus(status: string): OrderWorkflowStatus {
  if (isOrderStatus(status)) return status
  return legacyStatus[status] || 'pending_design_confirmation'
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
  const normalizedNext = typeof next === 'string' ? normalizeOrderStatus(next) : null
  if (!normalizedNext || !isOrderStatus(normalizedNext)) {
    throw new Error('Select a valid order status.')
  }

  const normalizedCurrent = normalizeOrderStatus(current)
  if (!allowedTransitions(normalizedCurrent).includes(normalizedNext)) {
    throw new Error(
      `${ORDER_STATUS_LABELS[normalizedCurrent]} cannot transition directly to ${ORDER_STATUS_LABELS[normalizedNext]}.`
    )
  }
  return normalizedNext
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