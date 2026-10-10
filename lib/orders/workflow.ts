export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "production",
  "ready_to_ship",
  "shipped",

  "pending_design_confirmation",
  "design_revision_required",
  "design_confirmed",
  "artwork_pending",

  "awaiting_payment_confirmation",
  "awaiting_payment",
  "payment_confirmed",
  "order_confirmed",

  "in_production",
  "quality_check",
  "printing_completed",
  "production_completed",
  "print_ready",

  "ready_for_pickup",
  "awaiting_dispatch",
  "out_for_delivery",
  "dispatched",

  "delivered",
  "completed",

  "on_hold",
  "cancelled",
  "refund_requested",
  "refunded",
] as const;

export type OrderWorkflowStatus = (typeof ORDER_STATUSES)[number];

export type OrderMilestone =
  | "pending"
  | "confirmed"
  | "production"
  | "dispatch"
  | "completed"
  | "attention";

export const ORDER_MILESTONE_LABELS: Record<OrderMilestone, string> = {
  pending: "Pending / Design",

  confirmed: "Confirmed",

  production: "Production",

  dispatch: "Dispatch / Pickup",

  completed: "Completed",

  attention: "Needs Attention",
};

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  pending: "Pending",

  confirmed: "Confirmed",

  production: "Production",

  ready_to_ship: "Ready to Ship",

  shipped: "Shipped",

  pending_design_confirmation: "Pending Design Confirmation",

  design_revision_required: "Design Revision Required",

  design_confirmed: "Design Confirmed",

  artwork_pending: "Artwork Pending",

  awaiting_payment_confirmation: "Awaiting Payment Confirmation",

  awaiting_payment: "Awaiting Payment",

  payment_confirmed: "Payment Confirmed",

  order_confirmed: "Order Confirmed",

  in_production: "In Production",

  quality_check: "Quality Check",

  printing_completed: "Printing Completed",

  production_completed: "Production Completed",

  print_ready: "Print Ready",

  ready_for_pickup: "Ready for Pickup",

  awaiting_dispatch: "Awaiting Dispatch",

  out_for_delivery: "Out for Delivery",

  dispatched: "Dispatched",

  delivered: "Delivered",

  completed: "Completed",

  on_hold: "On Hold",

  cancelled: "Cancelled",

  refund_requested: "Refund Requested",

  refunded: "Refunded",
};

const statusMilestones: Record<OrderWorkflowStatus, OrderMilestone> = {
  pending: "pending",

  artwork_pending: "pending",

  pending_design_confirmation: "pending",

  design_revision_required: "pending",

  confirmed: "confirmed",

  design_confirmed: "confirmed",

  awaiting_payment_confirmation: "confirmed",

  awaiting_payment: "confirmed",

  payment_confirmed: "confirmed",

  order_confirmed: "confirmed",

  production: "production",

  in_production: "production",

  quality_check: "production",

  printing_completed: "production",

  production_completed: "production",

  print_ready: "production",

  ready_to_ship: "dispatch",

  ready_for_pickup: "dispatch",

  awaiting_dispatch: "dispatch",

  shipped: "dispatch",

  dispatched: "dispatch",

  out_for_delivery: "dispatch",

  delivered: "completed",

  completed: "completed",

  on_hold: "attention",

  cancelled: "attention",

  refund_requested: "attention",

  refunded: "attention",
};
const transitions: Record<OrderWorkflowStatus, readonly OrderWorkflowStatus[]> =
  {
    pending_design_confirmation: [
      "design_revision_required",
      "design_confirmed",
      "order_confirmed",
      "on_hold",
      "cancelled",
    ],

    design_revision_required: [
      "pending_design_confirmation",
      "design_confirmed",
      "order_confirmed",
      "on_hold",
      "cancelled",
    ],

    artwork_pending: [
      "pending_design_confirmation",
      "design_confirmed",
      "order_confirmed",
      "on_hold",
      "cancelled",
    ],

    design_confirmed: [
      "awaiting_payment",
      "payment_confirmed",
      "order_confirmed",
    ],

    awaiting_payment_confirmation: [
      "payment_confirmed",
      "order_confirmed",
      "cancelled",
    ],

    awaiting_payment: ["payment_confirmed", "order_confirmed", "cancelled"],

    payment_confirmed: ["order_confirmed", "in_production"],

    order_confirmed: ["in_production", "print_ready", "on_hold", "cancelled"],

    in_production: ["quality_check", "printing_completed", "print_ready"],

    production: ["in_production", "print_ready"],

    quality_check: [
      "printing_completed",
      "production_completed",
      "print_ready",
    ],

    printing_completed: ["production_completed", "print_ready"],

    production_completed: ["print_ready"],

    print_ready: ["ready_for_pickup", "awaiting_dispatch", "out_for_delivery"],

    ready_for_pickup: ["completed", "delivered"],

    ready_to_ship: ["awaiting_dispatch", "out_for_delivery"],

    awaiting_dispatch: ["out_for_delivery"],

    shipped: ["out_for_delivery", "delivered"],

    out_for_delivery: ["delivered"],

    dispatched: ["delivered"],

    delivered: ["completed", "refund_requested", "refunded"],

    completed: ["refund_requested", "refunded"],

    refund_requested: ["refunded"],

    on_hold: ["order_confirmed", "in_production", "cancelled"],

    cancelled: ["refunded"],

    refunded: [],

    pending: ["pending_design_confirmation"],

    confirmed: ["order_confirmed"],
  };

export function isOrderStatus(value: unknown): value is OrderWorkflowStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

const legacyStatus: Record<string, OrderWorkflowStatus> = {
  pending: "pending_design_confirmation",

  artwork_pending: "artwork_pending",

  design_confirmed: "design_confirmed",

  awaiting_payment_confirmation: "awaiting_payment_confirmation",

  awaiting_payment: "awaiting_payment",

  payment_confirmed: "payment_confirmed",

  confirmed: "order_confirmed",

  production: "in_production",

  quality_check: "quality_check",

  printing_completed: "printing_completed",

  production_completed: "production_completed",

  ready_to_ship: "ready_for_pickup",

  awaiting_dispatch: "awaiting_dispatch",

  shipped: "out_for_delivery",

  dispatched: "out_for_delivery",

  refund_requested: "refund_requested",
};

export function normalizeOrderStatus(
  status?: string | null,
): OrderWorkflowStatus {
  if (!status) {
    return "pending_design_confirmation";
  }

  if (isOrderStatus(status)) {
    return status;
  }

  return legacyStatus[status] || "pending_design_confirmation";
}

export function orderMilestone(status: string): OrderMilestone {
  return statusMilestones[normalizeOrderStatus(status)];
}

export function orderMilestoneLabel(status: string): string {
  return ORDER_MILESTONE_LABELS[orderMilestone(status)];
}

export function allowedTransitions(
  status: string,
): readonly OrderWorkflowStatus[] {
  return transitions[normalizeOrderStatus(status)];
}

export function assertTransition(
  current: string,
  next: unknown,
): OrderWorkflowStatus {
  const nextStatus =
    typeof next === "string" ? normalizeOrderStatus(next) : null;

  if (!nextStatus) {
    throw new Error("Select a valid order status.");
  }

  const currentStatus = normalizeOrderStatus(current);

  if (!allowedTransitions(currentStatus).includes(nextStatus)) {
    throw new Error(
      `${ORDER_STATUS_LABELS[currentStatus]} cannot transition directly to ${ORDER_STATUS_LABELS[nextStatus]}.`,
    );
  }

  return nextStatus;
}

export function designDeadline(createdAt = new Date()): Date {
  return new Date(createdAt.getTime() + 6 * 60 * 60 * 1000);
}

export function deadlineState(
  deadline: Date | string | null,
  confirmedAt?: Date | string | null,
): {
  delayed: boolean;
  remainingMs: number | null;
} {
  if (!deadline) {
    return {
      delayed: false,
      remainingMs: null,
    };
  }

  const target = new Date(deadline).getTime();

  if (confirmedAt) {
    return {
      delayed: false,
      remainingMs: 0,
    };
  }

  const remaining = target - Date.now();

  return {
    delayed: remaining < 0,

    remainingMs: remaining,
  };
}
