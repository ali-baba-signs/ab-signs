import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  orderEmailEvents,
  orderItems,
  orders,
  storageAssets,
} from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/contact/mailer";
import { createPresignedDownloadUrl } from "@/lib/storage/r2";
/* 
// NOTE: Unused milestone/status update imports commented out per requirement
import {
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/workflow";
*/
import { getAuthBaseURL } from "@/lib/auth/origins";

export type OrderEmailType =
  | "order_confirmation"
  | "order_completed"
  | "order_update"
  | "sales_paid_order";

const SALES_EMAIL = "sales@alibabasigns.com.au";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

function money(value: unknown, currency: string) {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function siteUrl() {
  const configured = getAuthBaseURL();
  if (!configured)
    throw new Error(
      "BETTER_AUTH_URL or NEXT_PUBLIC_SITE_URL is required to create order email links.",
    );
  return configured;
}

async function emailData(orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order)
    throw new Error(
      "Order email cannot be prepared because the order no longer exists.",
    );
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const assetIds = [
    ...new Set(
      items.flatMap((item) =>
        [item.frontPreviewAssetId, item.previewAssetId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  ];
  const assets = assetIds.length
    ? await db
        .select()
        .from(storageAssets)
        .where(inArray(storageAssets.id, assetIds))
    : [];
  const urls = new Map(
    await Promise.all(
      assets.map(
        async (asset) =>
          [
            asset.id,
            await createPresignedDownloadUrl(asset.objectKey),
          ] as const,
      ),
    ),
  );
  return {
    order,
    items: items.map((item) => ({
      ...item,
      previewUrl: item.frontPreviewAssetId
        ? urls.get(item.frontPreviewAssetId)
        : item.previewAssetId
          ? urls.get(item.previewAssetId)
          : null,
    })),
  };
}

async function sendOrderConfirmation(orderId: string) {
  const { order, items } = await emailData(orderId);
  const address = (order.shippingAddress || {}) as Record<string, string>;
  const customerName =
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    "Customer";
  const subtotal =
    Number(order.totalAmount) -
    Number(order.shippingAmount) -
    Number(order.taxAmount) +
    Number(order.discountAmount);

  const lines = items.map((item) => {
    const specs = (item.specifications || {}) as Record<string, string>;
    const preview = item.previewUrl
      ? `\nArtwork preview: ${item.previewUrl}`
      : "";
    return `${specs.productName || "Product"}${specs.sku ? ` (SKU \${specs.sku})` : ""} — ${specs.sizeLabel || specs.variant || "Standard"} × ${item.quantity} at ${money(item.unitPrice, order.currency)} each: ${money(item.totalPrice, order.currency)}${preview}`;
  });

  const rows = items
    .map((item) => {
      const specs = (item.specifications || {}) as Record<string, string>;
      const previews = [
        [specs.productImage, "Product"],
        [item.previewUrl, "Your design"],
      ].filter(([url]) => Boolean(url));
      return `
        <tr>
          <td style="padding:16px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:100px;">
            ${previews
              .map(
                ([url, label]) => `
                  <div style="display:inline-block;margin:4px;text-align:center">
                    <img src="${escapeHtml(url)}" alt="${escapeHtml(label)} preview" width="80" style="border-radius:6px;border:1px solid #e5e7eb;max-width:80px;height:auto;display:block;margin:0 auto 4px;" />
                    <span style="font-size:11px;color:#6b7280;text-transform:uppercase;">${escapeHtml(label)}</span>
                  </div>`,
              )
              .join("")}
          </td>
          <td style="padding:16px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;font-size:15px;color:#111827;">${escapeHtml(specs.productName || "Product")}</div>
            ${specs.sku ? `<div style="font-size:12px;color:#6b7280;">SKU: ${escapeHtml(specs.sku)}</div>` : ""}
            <div style="font-size:13px;color:#4b5563;margin-top:4px;">${escapeHtml(specs.sizeLabel || specs.variant || "Standard")}</div>
            <div style="font-size:13px;color:#4b5563;">Qty: ${item.quantity} × ${escapeHtml(money(item.unitPrice, order.currency))}</div>
          </td>
          <td style="padding:16px 12px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;font-weight:600;font-size:15px;color:#111827;">
            ${escapeHtml(money(item.totalPrice, order.currency))}
          </td>
        </tr>`;
    })
    .join("");

  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Order received — ${order.orderNumber} — waiting for design confirmation`,
    text: `Hi ${customerName},\n\nWe received payment for order ${order.orderNumber}, placed ${order.createdAt.toLocaleString("en-AU")}.\nStatus: Order received — waiting for design confirmation.\n\n${lines.join("\n")}\n\nSubtotal: ${money(subtotal, order.currency)}\nDiscount: ${money(order.discountAmount, order.currency)}\nShipping: ${money(order.shippingAmount, order.currency)}\nGST / Tax: ${money(order.taxAmount, order.currency)}\nTotal paid: ${money(order.totalAmount, order.currency)}\n\nNext steps: Our design team is currently reviewing your artwork and will reach out with the design proof/confirmation shortly before proceeding to production.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2937;background-color:#ffffff;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h1 style="font-size:22px;color:#111827;margin-top:0;margin-bottom:12px;">Order Received</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">We have received payment for order <strong>#${escapeHtml(order.orderNumber)}</strong> placed on ${escapeHtml(order.createdAt.toLocaleString("en-AU"))}.</p>
        
        <div style="background-color:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">Current Status</div>
          <div style="font-size:15px;font-weight:600;color:#1d4ed8;margin-top:2px;">Waiting for Design Confirmation</div>
        </div>

        <h3 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:0;">Order Summary</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>

        <div style="margin-top:20px;padding:16px;background-color:#f9fafb;border-radius:6px;">
          <table style="width:100%;font-size:14px;color:#4b5563;line-height:1.8;">
            <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(money(subtotal, order.currency))}</td></tr>
            <tr><td>Discount</td><td style="text-align:right;">-${escapeHtml(money(order.discountAmount, order.currency))}</td></tr>
            <tr><td>Shipping</td><td style="text-align:right;">${escapeHtml(money(order.shippingAmount, order.currency))}</td></tr>
            <tr><td>GST / Tax</td><td style="text-align:right;">${escapeHtml(money(order.taxAmount, order.currency))}</td></tr>
            <tr style="border-top:1px solid #e5e7eb;font-weight:bold;font-size:16px;color:#111827;">
              <td style="padding-top:8px;">Total Paid</td>
              <td style="text-align:right;padding-top:8px;">${escapeHtml(money(order.totalAmount, order.currency))}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
          <h3 style="font-size:15px;color:#111827;margin:0 0 6px;">What happens next?</h3>
          <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0;">
            Our production prep team will inspect your submitted files. We will send you a confirmation when your artwork is ready for production.
          </p>
        </div>
      </div>`,
  });
}

async function sendSalesPaidOrder(orderId: string) {
  const { order, items } = await emailData(orderId);
  const address = (order.shippingAddress || {}) as Record<string, string>;
  const customerName =
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    "Customer";
  const phone = address.phone || "Not provided";
  const shippingAddress =
    order.deliveryType === "pickup"
      ? "Pickup order"
      : [
          address.address,
          address.addressLine2,
          address.city || address.suburb,
          address.state,
          address.postalCode,
          address.country,
        ]
          .filter(Boolean)
          .join(", ") || "Not provided";
  const itemLines = items.map((item) => {
    const specs = (item.specifications || {}) as Record<string, string>;
    return `${specs.productName || "Product"}${specs.sku ? ` (SKU \${specs.sku})` : ""} — ${specs.sizeLabel || specs.variant || "Standard"} × ${item.quantity} — ${money(item.totalPrice, order.currency)}`;
  });
  const itemRows = items
    .map((item) => {
      const specs = (item.specifications || {}) as Record<string, string>;
      return `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(specs.productName || "Product")}${specs.sku ? `<br><small>SKU: ${escapeHtml(specs.sku)}</small>` : ""}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(specs.sizeLabel || specs.variant || "Standard")}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(money(item.totalPrice, order.currency))}</td></tr>`;
    })
    .join("");
  return sendTransactionalEmail({
    to: SALES_EMAIL,
    subject: `New Paid Order - ${order.orderNumber}`,
    text: `A new paid order is ready for sales review.\n\nCustomer name: ${customerName}\nCustomer email: ${order.customerEmail}\nPhone: ${phone}\nOrder number: ${order.orderNumber}\nPayment status: ${order.paymentStatus}\nShipping address: ${shippingAddress}\n\nProducts / items:\n${itemLines.join("\n")}\n\nTotal amount: ${money(order.totalAmount, order.currency)}`,
    html: `<h1>New paid order</h1><p><strong>Customer name:</strong> ${escapeHtml(customerName)}<br><strong>Customer email:</strong> ${escapeHtml(order.customerEmail)}<br><strong>Phone:</strong> ${escapeHtml(phone)}<br><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}<br><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus)}<br><strong>Shipping address:</strong> ${escapeHtml(shippingAddress)}</p><h2>Products / items</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Size</th><th style="padding:8px;text-align:center">Quantity</th><th style="padding:8px;text-align:right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><p><strong>Total amount: ${escapeHtml(money(order.totalAmount, order.currency))}</strong></p>`,
  });
}

/*
// ============================================================================
// COMMENTED OUT: Milestone update emails are disabled per requirement.
// ============================================================================
async function sendOrderUpdate(
  orderId: string,
  payload: Record<string, unknown>,
) {
  const { order } = await emailData(orderId);
  const address = (order.shippingAddress || {}) as Record<string, string>;
  const customerName =
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    "Customer";
  const status =
    ORDER_STATUS_LABELS[
      normalizeOrderStatus(String(payload.status || order.status))
    ];
  const note =
    typeof payload.customerNote === "string" ? payload.customerNote.trim() : "";
  const accountUrl = `${siteUrl()}/account/orders/${order.id}`;
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Update for ${order.orderNumber}: ${status}`,
    text: `Hi ${customerName},\n\nYour order ${order.orderNumber} has been updated.\nStatus: ${status}${note ? `\nNote from our team: \${note}` : ""}\n\nView the latest order details: ${accountUrl}`,
    html: `<h1>Order update</h1><p>Hi ${escapeHtml(customerName)},</p><p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been updated.</p><p><strong>Status:</strong> ${escapeHtml(status)}</p>${note ? `<p><strong>Note from our team:</strong><br>\${escapeHtml(note).replace(/\r?\n/g, "<br>")}</p>` : ""}<p><a href="${escapeHtml(accountUrl)}">View the latest order details</a></p>`,
  });
}
*/

async function sendOrderCompleted(orderId: string) {
  const { order, items } = await emailData(orderId);
  const address = (order.shippingAddress || {}) as Record<string, string>;
  const customerName =
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    "Customer";

  const itemLines = items.map((item) => {
    const specs = (item.specifications || {}) as Record<string, string>;
    const reviewUrl = `${siteUrl()}/account/orders/${order.id}/review?itemId=${item.id}`;
    return `${specs.productName || "Product"}${specs.sku ? ` (SKU \${specs.sku})` : ""} — ${specs.sizeLabel || specs.variant || "Standard"} × ${item.quantity}\nReview link: ${reviewUrl}`;
  });

  const delivery =
    order.deliveryType === "pickup"
      ? "Your order has been completed and collected."
      : `Your order has been completed and delivered${order.trackingNumber ? ` (Tracking: \${order.trackingNumber})` : ""}.`;

  const itemReviewCards = items
    .map((item) => {
      const specs = (item.specifications || {}) as Record<string, string>;
      const reviewUrl = `${siteUrl()}/account/orders/${order.id}/review?itemId=${item.id}`;
      const itemTitle = specs.productName || "Product";
      const itemVariant = specs.sizeLabel || specs.variant || "Standard";

      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;background-color:#ffffff;display:flex;align-items:center;justify-content:space-between;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-weight:600;font-size:15px;color:#111827;">${escapeHtml(itemTitle)}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(itemVariant)} · Qty: ${item.quantity}</div>
              </td>
              <td style="text-align:right;vertical-align:middle;padding-left:16px;">
                <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background-color:#ED1B68;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:14px;font-weight:600;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);white-space:nowrap;">
                  ★ Leave Review
                </a>
              </td>
            </tr>
          </table>
        </div>`;
    })
    .join("");

  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Your order is ${order.status === "delivered" ? "delivered" : "ready"} — Ali Baba Signs`,
    text: `Hi ${customerName},\n\n${delivery}\n\nOrder #${order.orderNumber}\n\n${itemLines.join("\n\n")}\n\n${order.deliveryNote || order.customerNotes || ""}\n\nWe value your feedback! Please use the review links above to let us know about your experience.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2937;background-color:#ffffff;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h1 style="font-size:22px;color:#111827;margin-top:0;margin-bottom:12px;">${order.status === "delivered" ? "Your order has been delivered!" : "Your order is complete!"}</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 20px;">${escapeHtml(delivery)}</p>

        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:14px;">
          <strong>Order Number:</strong> #${escapeHtml(order.orderNumber)}
          ${order.deliveryNote || order.customerNotes ? `<br><span style="color:#6b7280;margin-top:4px;display:inline-block;">${escapeHtml(order.deliveryNote || order.customerNotes)}</span>` : ""}
        </div>

        <div style="background-color:#f0ffebf2fdf4;border:1px solid #ED1B68;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
          <h2 style="font-size:18px;color:#ED1B68;margin:0 0 6px;">How did we do?</h2>
          <p style="font-size:14px;color:#8f0638;margin:0 0 16px;line-height:1.4;">
            Your feedback means the world to our team. Click below to review your items:
          </p>
          ${itemReviewCards}
        </div>

        <p style="font-size:13px;color:#6b7280;text-align:center;margin:24px 0 0;">
          Thank you for choosing Ali Baba Signs!
        </p>
      </div>`,
  });
}

/** Delivers a previously claimed event. Failures are recorded and never roll back order state. */
export async function deliverOrderEmailEvent(eventId: string) {
  const [event] = await db
    .select()
    .from(orderEmailEvents)
    .where(eq(orderEmailEvents.id, eventId))
    .limit(1);
  if (!event || event.status !== "processing")
    return { sent: false, skipped: true };
  try {
    let messageId: string | null;
    if (event.eventType === "order_confirmation")
      messageId = await sendOrderConfirmation(event.orderId);
    else if (event.eventType === "order_completed")
      messageId = await sendOrderCompleted(event.orderId);
    /*
    // Milestone updates disabled:
    else if (event.eventType === "order_update")
      messageId = await sendOrderUpdate(event.orderId, (event.payload || {}) as Record<string, unknown>);
    */
    else if (event.eventType === "order_update") {
      // Mark milestone update as skipped without sending
      await db
        .update(orderEmailEvents)
        .set({
          status: "skipped",
          updatedAt: new Date(),
        })
        .where(eq(orderEmailEvents.id, event.id));
      return { sent: false, skipped: true };
    }
    else if (event.eventType === "sales_paid_order")
      messageId = await sendSalesPaidOrder(event.orderId);
    else throw new Error("Unknown order email event type.");
    
    await db
      .update(orderEmailEvents)
      .set({
        status: "sent",
        providerMessageId: messageId,
        sentAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(orderEmailEvents.id, event.id));
    return { sent: true, skipped: false };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 2000)
        : "Order email delivery failed.";
    await db
      .update(orderEmailEvents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(orderEmailEvents.id, event.id));
    console.error("Order email delivery failed", {
      orderId: event.orderId,
      eventType: event.eventType,
      error: message,
    });
    return { sent: false, skipped: false, error: message };
  }
}