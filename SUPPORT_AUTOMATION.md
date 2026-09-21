# Support automation deployment

## Rule-based chatbot update

The chatbot uses local rules only, with no AI API or new dependency. `lib/support/rules.ts` owns the action registry, responses, intent matching and notification policy. Buttons send `action` to the existing `/api/live-chat` POST endpoint. The response is `{ data: { intent, response, requiresHuman, collectOrderId, notifyTeam } }`. Verified tracking additionally includes `order` with status, nextStep, trackingNumber and deliveryEstimate. Missing tracking values are null; estimates are never invented. Existing order ownership and verified-email checks apply. Selecting a button only displays a prompt; it never sends email. Human requests are submitted only when a signed-in customer sends their message. Custom quotes use the existing contact form for product, size, quantity, deadline and artwork.

The existing n8n webhook URL, authentication and event contract remain in place. **Update the existing workflow's email branches to check `sendCustomerEmail === true` and `notifyTeam === true` (or `notification.enabled`) before sending.** This is necessary to enforce selective delivery in an externally managed workflow. Ordinary FAQ and tracking responses never call the webhook, including on admin retry. Contact FAQs remain in the inbox with `not_required` delivery status.

| Intent | Customer email | Team notification |
| --- | --- | --- |
| Custom quote, payment, human support | Yes | Yes |
| Complaint, urgent request | No | Yes |
| Products, artwork, delivery, privacy, tracking, unknown | No | No |

Additional tests: `tests/support-rules.test.ts`. The chatbot update uses existing order tracking fields and requires no additional migration. No n8n workflow was remotely changed or live email sent during implementation.

Website-side implementation only. n8n must be configured before enabling this release for customers. The website saves enquiries in the existing admin inbox and forwards structured events; it does not send support emails itself.

## Configuration

Apply `sql/2026-09-20-support-automation.sql` before starting the updated app. This adds one nullable JSON column, `contact_submissions.support_payload`, for reliable retries, source, quote details and private artwork references. Existing enquiries remain readable. Support settings use the existing store-settings JSON record; no new settings table.

In the existing admin Settings page (`/staff-portal/settings`), configure Support Settings: opening days, opening/closing time, timezone, business-hours switch, both reply messages, webhook URL and team notification emails. Addresses can be added, edited and removed; no real recipients are seeded. Default hours are Monday–Friday 09:00–17:00 Australia/Melbourne. Closing time is exclusive; overnight schedules and daylight saving are supported. Disabling hours uses the normal acknowledgement at all times.

Server environment:

| Variable | Purpose |
| --- | --- |
| `SUPPORT_WEBHOOK_URL` | Optional override of admin URL; fallback is `https://automation.alibabasigns.com.au/webhook/support-message` |
| `SUPPORT_WEBHOOK_ALLOWED_HOSTS` | Comma-separated hostname allowlist; default `automation.alibabasigns.com.au` |
| `SUPPORT_WEBHOOK_SECRET` | Required secret, at least 32 characters, matching n8n Header Auth |
| `SUPPORT_CHANNEL_SECRET` | Separate secret of at least 32 characters for future trusted channel adapters; leaving empty disables that endpoint |

The existing `CONTACT_RATE_LIMIT_SALT` or `BETTER_AUTH_SECRET` salts IP hashes. Do not put secrets in public environment variables, URL parameters or admin webhook URLs. Environment URL overrides the saved admin URL. Use a trusted reverse proxy that overwrites client IP headers and configure its upload limit for the supported 100 MB artwork plus multipart overhead. Run production behind HTTPS with correct auth/site origins.

## API and workflow contract

- `POST /api/support/messages`: public website JSON or multipart input.
- `POST /api/contact`: existing form endpoint, same handler.
- `POST /api/live-chat`: existing signed-in chat, same support processor.
- `POST /api/support/channels`: future trusted adapters, requires `x-support-channel-secret`; accepts `source` Website, Facebook or WhatsApp. Verify provider signatures in each adapter before calling it. This is not a public Facebook/WhatsApp callback or SDK integration.
- `POST /api/admin/enquiries/:id/retry`: authenticated administrator retry of a saved failed event, using current recipients and refreshed artwork links.

Required inputs are customerName, customerEmail, category and message (10–5000 characters; chat up to 2000). Optional phone, subject, company and pageUrl are accepted. Order status requires orderNumber. Custom quote requires product, size and integer quantity, with optional requiredDate and artwork. Existing contact name/email/enquiryType fields remain accepted.

The website sends an HTTPS POST with headers `x-support-webhook-secret` and `x-support-event-id`. Configure n8n Webhook Header Auth using the former. The JSON contains:

```json
{
  "schemaVersion": 1,
  "eventId": "stable-uuid-for-deduplication",
  "customerName": "Example Customer",
  "customerEmail": "customer@example.com",
  "phone": "",
  "category": "Custom quote",
  "message": "Please quote for these banners.",
  "pageUrl": "https://alibabasigns.com.au/contact",
  "timestamp": "2026-09-21T02:00:00.000Z",
  "source": "Website",
  "priority": "HIGH",
  "quote": { "product": "Banner", "size": "2 x 1 m", "quantity": 2, "requiredDate": "", "notes": "Please quote for these banners." },
  "artwork": null,
  "artworkUploaded": false,
  "orderStatus": null,
  "availability": { "isBusinessHours": true, "timezone": "Australia/Melbourne", "response": "Configured business-hours reply" },
  "acknowledgement": "Configured business-hours reply",
  "businessHours": { "enabled": true, "timezone": "Australia/Melbourne", "openingDays": [1,2,3,4,5], "openingTime": "09:00", "closingTime": "17:00", "businessHoursResponse": "Configured business-hours reply", "afterHoursResponse": "Configured after-hours reply" },
  "notification": { "emails": ["team@example.com"], "subject": "New Alibaba Signs Support Request", "priority": "HIGH" }
}
```

n8n workflow: authenticated webhook → validate schema → durable eventId deduplication → business-hours branch → customer acknowledgement → team notification. Use supplied availability, calculated for the original receipt timestamp in the configured timezone, or evaluate the supplied schedule against that timestamp. Send acknowledgement to customerEmail and team notification to notification.emails. Include customer name/email/phone, category, message, page and timestamp. For quotes include HIGH priority, product, size, quantity, required date, notes and artwork availability. Use plain text or HTML escaping for all customer content. Preserve per-step delivery state so a partial workflow retry does not resend completed emails. Return 2xx only after the event is durably accepted. Monitor downstream email failures in n8n.

Artwork is stored privately and supplied as a signed download URL valid for 900 seconds. Fetch it promptly in n8n; do not email an expiring URL as permanent access. Never replace private artwork URLs with public R2 development URLs. An interrupted upload blocks retry until the team resolves the missing file with the customer.

## Security and recovery

Inputs, categories, email, file types/signatures, SVG content and dates are validated. Request bodies are bounded. A honeypot filters simple form bots. A database-backed limit of five enquiries per IP or email per 15 minutes is serialized across workers. Configure proxy IP headers correctly; rate limiting is not a replacement for edge-level abuse protection.

Order status is returned only to a signed-in, email-verified account matching the supplied order email and, for registered orders, the owning user ID. Responses contain only status and next step. Unknown orders and unverified users receive the same verification prompt. Trusted channel messages do not bypass order ownership verification.

Public settings omit support recipients, webhook configuration and secrets. Outbound hosts are server-allowlisted, HTTPS only, and redirects are rejected. Saved event IDs are reused on retry. A timeout may occur after n8n accepted an event, so n8n deduplication is essential. The admin inbox reports `forwarded` as webhook acceptance, not email delivery. Failed delivery returns a saved enquiry reference and instructions not to resubmit. There is no automatic retry queue; administrators retry failed events from Enquiries. Events left pending after a process crash require operator review.

## Verification

Run `node --import tsx --test tests/*.test.ts` and `node --require ./scripts/server-only-register.cjs --import tsx scripts/verify-support-delivery.ts`. The latter mocks outbound HTTP and sends no email. It checks webhook headers, acceptance/failure, quote priority, current recipients, business-hour replies, secret omission and unverified order protection.

Live customer acknowledgement and team email delivery require a configured n8n workflow, recipients and matching secret. They cannot be inferred from mocked tests or an HTTP 2xx. Finish a controlled live test after configuring n8n, including a changed recipient, after-hours enquiry and custom quote with artwork.
