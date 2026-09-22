"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import type { PurchasedCartLine } from "@/lib/cart/checkout-removal";

type StoredPayment = {
  orderId: string;
  orderNumber: string;
  checkoutToken: string;
  cartLines?: PurchasedCartLine[];
};
type PaymentSummary = {
  orderNumber: string;
  paymentStatus: string;
  status: string;
  totals: { total: string; currency: string };
};

export function OrderSuccessContent({ orderNumber }: { orderNumber?: string }) {
  const { clearCart, removePurchasedItems } = useCart();
  const [state, setState] = useState<
    "checking" | "paid" | "failed" | "pending"
  >("checking");
  const [message, setMessage] = useState(
    "Processing payment… Please do not refresh.",
  );
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = async () => {
      try {
        const raw = sessionStorage.getItem("abs-payment");
        if (!raw) {
          setState("pending");
          setMessage(
            "Open your account orders to check the latest verified payment status.",
          );
          return;
        }
        const stored = JSON.parse(raw) as StoredPayment;
        const response = await fetch("/api/payments/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderId: stored.orderId,
            checkoutToken: stored.checkoutToken,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data)
          throw new Error(
            payload?.error?.message || "Payment status could not be checked.",
          );
        if (stopped) return;
        setSummary(payload.data);
        if (payload.data.paymentStatus === "paid") {
          if (Array.isArray(stored.cartLines))
            removePurchasedItems(stored.cartLines);
          else clearCart();
          sessionStorage.removeItem("abs-payment");
          setState("paid");
          setMessage(
            "Payment completed. Your order has been received and a confirmation email is on its way.",
          );
          return;
        }
        if (
          ["payment_failed", "cancelled"].includes(payload.data.paymentStatus)
        ) {
          setState("failed");
          setMessage(
            payload.data.paymentStatus === "cancelled"
              ? "This payment was cancelled."
              : "Stripe declined or could not complete the payment. Review the card message and retry safely.",
          );
          return;
        }
        attempts += 1;
        if (attempts >= 15) {
          setState("pending");
          setMessage(
            "Stripe still reports this payment as processing. The order is saved; check your orders shortly or retry this status check.",
          );
          return;
        }
        timer = setTimeout(check, 2000);
      } catch (reason) {
        if (!stopped) {
          setState("pending");
          setMessage(
            reason instanceof Error
              ? reason.message
              : "Payment status is temporarily unavailable.",
          );
        }
      }
    };
    void check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [clearCart, removePurchasedItems, retry]);

  const number = summary?.orderNumber || orderNumber;
  const icon =
    state === "paid" ? (
      <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
    ) : state === "checking" ? (
      <LoaderCircle className="mx-auto h-14 w-14 animate-spin text-primary" />
    ) : (
      <AlertCircle className="mx-auto h-14 w-14 text-amber-600" />
    );
  return (
    <main className="grid min-h-[70vh] place-items-center bg-background p-6">
      <section
        className="w-full max-w-xl rounded-2xl border bg-card p-8 text-center shadow-sm"
        aria-live="polite"
      >
        {icon}
        <p className="mt-5 text-sm font-bold uppercase tracking-wide text-primary">
          {state === "paid"
            ? "Payment verified"
            : state === "failed"
              ? "Payment not completed"
              : "Payment status"}
        </p>
        <h1 className="mt-1 text-3xl font-black">
          {state === "paid"
            ? "Thank you for your order"
            : state === "checking"
              ? "Processing payment…"
              : "Your order is saved"}
        </h1>
        {number && <p className="mt-3 font-semibold">Order {number}</p>}
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{message}</p>
        {summary && (
          <div className="mx-auto mt-5 flex max-w-xs justify-between rounded-lg bg-secondary p-4 font-bold">
            <span>Total</span>
            <span>
              {summary.totals.currency} $
              {Number(summary.totals.total).toFixed(2)}
            </span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {state === "failed" && (
            <Link href="/payment">
              <Button>Retry payment</Button>
            </Link>
          )}
          {state === "pending" && (
            <Button
              onClick={() => {
                setState("checking");
                setMessage("Processing payment… Please do not refresh.");
                setRetry((value) => value + 1);
              }}
            >
              Check again
            </Button>
          )}
          <Link href="/account/orders">
            <Button variant="outline">View my orders</Button>
          </Link>
          {state === "paid" && (
            <Link href="/products">
              <Button>Continue Shopping</Button>
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
