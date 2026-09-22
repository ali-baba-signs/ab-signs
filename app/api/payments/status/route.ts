import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/middleware";
import { loadPaymentOrder, paymentSummary } from "@/lib/payments/order-summary";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { paymentRecords } from "@/lib/db/schema";
import {
  paymentEventForIntent,
  reconcileStripePayment,
} from "@/lib/payments/reconcile";

export async function POST(request: NextRequest) {
  try {
    const { orderId, checkoutToken } = (await request.json()) as {
      orderId?: string;
      checkoutToken?: string;
    };
    if (!orderId || !checkoutToken)
      return NextResponse.json(
        { error: { message: "Order authorization is required." } },
        { status: 400 },
      );
    const data = await loadPaymentOrder(orderId);
    if (!data)
      return NextResponse.json(
        { error: { message: "Order not found." } },
        { status: 404 },
      );
    const session = await getSession();
    if (
      data.order.userId
        ? data.order.userId !== session?.user.id
        : data.order.idempotencyKey !== checkoutToken
    )
      return NextResponse.json(
        { error: { message: "This order is not available." } },
        { status: 403 },
      );
    if (
      !["paid", "cancelled"].includes(data.order.paymentStatus) &&
      process.env.STRIPE_SECRET_KEY
    ) {
      try {
        const [payment] = await db
          .select()
          .from(paymentRecords)
          .where(
            and(
              eq(paymentRecords.orderId, data.order.id),
              eq(paymentRecords.provider, "stripe"),
            ),
          )
          .limit(1);
        if (payment?.externalId) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            timeout: 10_000,
            maxNetworkRetries: 1,
          });
          const intent = await stripe.paymentIntents.retrieve(
            payment.externalId,
          );
          const eventType = paymentEventForIntent(intent);
          await reconcileStripePayment({
            intent,
            eventType,
            eventId: `reconcile:${intent.id}:${intent.status}:${intent.last_payment_error?.code || "none"}`,
          });
          const refreshed = await loadPaymentOrder(orderId);
          if (refreshed)
            return NextResponse.json(
              { data: paymentSummary(refreshed) },
              { headers: { "cache-control": "private, no-store" } },
            );
        }
      } catch (error) {
        console.error(
          "Stripe status reconciliation failed; returning the safely stored order status.",
          error,
        );
      }
    }
    return NextResponse.json(
      { data: paymentSummary(data) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Payment status request failed", error);
    return NextResponse.json(
      { error: { message: "Payment status is temporarily unavailable." } },
      { status: 400 },
    );
  }
}
