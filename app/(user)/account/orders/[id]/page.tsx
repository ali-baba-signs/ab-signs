"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderMilestoneLabel } from "@/lib/orders/workflow";

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalAmount: string;
  taxAmount: string;
  shippingAmount: string;
  shippingAddress: Record<string, string>;
  designConfirmationDeadline: string | null;
  deadline: { delayed: boolean; remainingMs: number | null };
  expectedPrintingAt: string | null;
  expectedDeliveryAt: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  customerNotes: string | null;
  deliveryType: "delivery" | "pickup";
  expectedPickupAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  readyForPickupAt: string | null;
  pickupCompletedAt: string | null;
  items: Array<{
    id: string;
    quantity: number;
    totalPrice: string;
    designSource: string;
    specifications: Record<string, string> | null;
    product?: { name: string };
    artworkUrl?: string;
    designUrl?: string;
    previewUrl?: string;
    productionUrl?: string;
  }>;
  history: Array<{
    id: string;
    newStatus: string;
    customerVisibleNote: string | null;
    changedAt: string;
  }>;
}

function ItemThumbnail({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded border bg-muted/40 text-muted-foreground">
        <ImageOff className="h-5 w-5 opacity-60" />
        <span className="mt-1 text-[10px]">No preview</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/20">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain p-1"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function CustomerOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/orders/${id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.error?.message || "Order could not be loaded."
          );
        }
        setOrder(payload.data.order);
      })
      .catch((caught) => {
        if (caught.name !== "AbortError") setError(caught.message);
      });
    return () => controller.abort();
  }, [id]);

  if (!order) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        {error || "Loading order..."}
      </div>
    );
  }

  const subtotal =
    Number(order.totalAmount) -
    Number(order.taxAmount) -
    Number(order.shippingAmount);
  const label = orderMilestoneLabel;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> My orders
        </Link>

        <div className="mt-3 flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="font-bold">{label(order.status)}</p>
            <p className="text-sm">
              Payment: {order.paymentStatus.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        {order.designConfirmationDeadline && (
          <div
            className={`mt-5 rounded p-3 text-sm ${
              order.deadline.delayed
                ? "bg-red-50 text-red-800"
                : "bg-green-50 text-green-800"
            }`}
          >
            Design confirmation target:{" "}
            {new Date(order.designConfirmationDeadline).toLocaleString()}
            {order.deadline.delayed
              ? " — delayed; the order remains active"
              : ""}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-bold">Products and artwork</h2>
              <div className="mt-3 space-y-3">
                {order.items.map((item) => {
                  const previewUrl = item.previewUrl || item.artworkUrl;

                  return (
                    <article key={item.id} className="rounded border p-3">
                      <div className="flex items-start gap-4">
                        <ItemThumbnail
                          src={previewUrl}
                          alt={item.product?.name || "Artwork Preview"}
                        />

                        <div className="flex-1 space-y-1">
                          <p className="font-semibold">
                            {item.product?.name || "Product"} × {item.quantity}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.specifications?.sizeLabel || "Standard size"} ·{" "}
                            {item.designSource.replaceAll("_", " ")}
                          </p>
                          <p className="font-medium">
                            {order.currency} ${Number(item.totalPrice).toFixed(2)}
                          </p>

                          <div className="flex flex-wrap gap-3 pt-1 text-xs">
                            {previewUrl && (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Open preview in new tab
                              </a>
                            )}
                            {item.artworkUrl && item.artworkUrl !== previewUrl && (
                              <a
                                href={item.artworkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Original upload
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {["delivered", "completed"].includes(order.status) && (
                        <div className="mt-3">
                          <Link href={`/account/orders/${order.id}/review?itemId=${item.id}`}>
                            <Button variant="outline" size="sm">
                              Review this item
                            </Button>
                          </Link>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-bold">Order timeline</h2>
              <ol className="mt-4 border-l-2 border-primary/30 pl-5">
                {order.history.map((item) => (
                  <li key={item.id} className="relative mb-5">
                    <p className="font-semibold">{label(item.newStatus)}</p>
                    {item.customerVisibleNote && (
                      <p className="text-sm text-muted-foreground">
                        {item.customerVisibleNote}
                      </p>
                    )}
                    <time className="text-xs">
                      {new Date(item.changedAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-bold">
                {order.deliveryType === "pickup" ? "Pickup" : "Delivery"}
              </h2>
              <p className="text-sm">
                Expected printing:{" "}
                {order.expectedPrintingAt
                  ? new Date(order.expectedPrintingAt).toLocaleString()
                  : "Not scheduled"}
              </p>
              {order.deliveryType === "pickup" ? (
                <div className="space-y-1 text-sm">
                  <p>
                    Expected pickup:{" "}
                    {order.expectedPickupAt
                      ? new Date(order.expectedPickupAt).toLocaleString()
                      : "Not scheduled"}
                  </p>
                  <p>
                    {order.readyForPickupAt
                      ? "Ready since " +
                        new Date(order.readyForPickupAt).toLocaleString()
                      : "We will let you know when the order is ready."}
                  </p>
                  {order.pickupCompletedAt && (
                    <p>
                      Picked up:{" "}
                      {new Date(order.pickupCompletedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>
                    Expected delivery:{" "}
                    {order.expectedDeliveryAt
                      ? new Date(order.expectedDeliveryAt).toLocaleString()
                      : "Not scheduled"}
                  </p>
                  <p>
                    {order.courierName || "Courier not assigned"}{" "}
                    {order.trackingNumber && `· ${order.trackingNumber}`}
                  </p>
                  {order.dispatchedAt && (
                    <p>
                      Dispatched:{" "}
                      {new Date(order.dispatchedAt).toLocaleString()}
                    </p>
                  )}
                  {order.deliveredAt && (
                    <p>
                      Delivered: {new Date(order.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              {order.customerNotes && (
                <p className="mt-2 text-sm">{order.customerNotes}</p>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-xl border bg-card p-5">
            <h2 className="font-bold">Billing summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </p>
              <p className="flex justify-between">
                <span>Tax</span>
                <span>${Number(order.taxAmount).toFixed(2)}</span>
              </p>
              <p className="flex justify-between">
                <span>Shipping</span>
                <span>${Number(order.shippingAmount).toFixed(2)}</span>
              </p>
              <p className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>
                  {order.currency} ${Number(order.totalAmount).toFixed(2)}
                </span>
              </p>
            </div>

            {order.paymentStatus === "paid" && (
              <a
                href={`/api/orders/${order.id}/receipt`}
                download
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Download className="h-4 w-4" />
                <span>Download payment receipt PDF</span>
              </a>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}