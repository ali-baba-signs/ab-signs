# Ali Baba Signs

## Product SEO URLs and sitemap

Product IDs remain UUIDs for orders, the editor, artwork uploads, and admin APIs. Public product URLs use the persisted `products.slug` column. The database assigns a slug from the name on insert, appends `-2`, `-3`, and so on for duplicate names, and keeps the slug when the name changes. Existing products receive slugs in a deterministic backfill. A UUID product URL returns HTTP 301 to its slug URL; product pages publish that URL as their canonical and Open Graph URL.

The XML sitemap at `/sitemap.xml` is an index of a static sitemap and 10,000-product pages at `/sitemaps/products/{page}`. It includes only active, public, indexable products and uses `products.updated_at` for product `lastmod`. `/robots.txt` references the index. `seo_noindex` defaults to false; set it to true for a product that should remain accessible but be excluded from indexing and the sitemap. Inactive products and deleted products are never included.

### Deployment

1. Back up the production database and apply [the product SEO migration](sql/2026-11-05-product-seo-slugs.sql) **before** deploying this code. With the deployment database URL in the environment, run `node scripts/apply-migration.mjs 2026-11-05-product-seo-slugs.sql` (or load a local env file with Node's `--env-file`). The migration adds and backfills slugs and is recorded by `schema_migrations`.
2. Deploy the application. Confirm that the hosting configuration routes `alibabasigns.com.au` and `www.alibabasigns.com.au` to this deployment. The app redirects the `www` and HTTP variants to `https://alibabasigns.com.au`.
3. Check a known product at `/products/{slug}`, its old `/products/{uuid}` URL, `/sitemap.xml`, `/sitemaps/products/0`, and `/robots.txt`. Resubmit the sitemap in Google Search Console after deployment.

The migration leaves names and UUIDs untouched. It does not require changing cart or checkout records. If a product must be excluded while remaining live, run `UPDATE products SET seo_noindex = true, updated_at = now() WHERE id = '<uuid>';` through the protected database administration process.

### Verification after deployment

Use a published product UUID and its stored slug. Check that the slug URL returns 200 with an H1, canonical tag, description, Open Graph tags and Product JSON-LD; the UUID URL returns 301 with any query string preserved; and the slug appears once in `/sitemaps/products/0`. Set a test product inactive or `seo_noindex = true` and confirm it disappears from the sitemap. Create two test products with the same name to confirm distinct slugs; rename one and confirm its slug stays the same. Check cart, Design Online and Upload Artwork using the slug URL. Restore or remove the test records after verification.

## Meta Pixel

Set `NEXT_PUBLIC_META_PIXEL_ID=1411263227123131` in the hosting environment and rebuild. The optional `.env.example` entry shows the format. The root layout loads the base pixel once in production. Development (`next dev`) disables it, even if the variable is set; removing the variable from a production build also disables it.

To test, run a production build with the ID configured and use Meta Events Manager Test Events or the Meta Pixel Helper browser extension. Visit pages and product details, add an item, proceed from checkout to payment, submit an enquiry, and complete a Stripe test payment. Confirm Purchase appears only after the order confirmation page receives a `paid` status from `/api/payments/status`. Refresh that confirmation page to check that Purchase is not sent twice in the same browser session.

## Local Setup

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="use-a-real-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

Authentication resolves its origin in this order: `BETTER_AUTH_URL`, then
`NEXT_PUBLIC_SITE_URL`, then the incoming request origin. Use the same origin
for both variables in each environment. No source-code change is needed when
moving between local development, testing, and production.

Next.js loads env files into `process.env`. For local development, `.env.local`
overrides `.env`. Do not use `process.env.local`; that object does not exist
and will crash the app. After editing `.env.local`, restart the dev server.

For deployment, configure these values in the hosting provider's environment
variables because `.env.local` is local-only and should not be deployed:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="production-random-secret"
BETTER_AUTH_URL="https://your-real-domain.com"
NEXT_PUBLIC_SITE_URL="https://your-real-domain.com"
```

Generate a good local auth secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Test Neon Connection

Run:

```powershell
node scripts/test-neon.js
```

Expected result:

```text
OK Connected to Neon
OK Required tables exist
Admin users: 3
```

If tables are missing, open the Neon SQL editor and run:

```text
sql/neon-init.sql
```

If login/signup does not work locally, check:

- `BETTER_AUTH_SECRET` is not `generate-a-32-byte-random-secret`.
- `BETTER_AUTH_URL` is `http://localhost:3000` for local dev.
- The dev server was restarted after editing `.env.local`.
- Browser devtools Network tab shows `/api/auth/sign-in/email` or `/api/auth/sign-up/email` returning `200`.

## Run The App

```powershell
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3000
```

Admin login (the direct `/admin` route intentionally returns 404):

```text
http://localhost:3000/staff-portal/login
```

## Database Migration

After `sql/neon-init.sql` and `sql/admin-auth-init.sql`, apply the commerce/admin migration:

```powershell
node --env-file=.env.local scripts/apply-migration.mjs
```

The runner records the migration in `schema_migrations` and is safe to rerun.

## Cloudflare R2

Admin uploads use a same-origin server endpoint and do not require browser-to-R2 CORS. Configure:

```env
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_R2_BUCKET="your-bucket"
CLOUDFLARE_R2_ACCESS_KEY_ID="an-R2-S3-access-key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="the-matching-secret"
CLOUDFLARE_R2_PUBLIC_URL="https://assets.alibabasigns.com.au"
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://assets.alibabasigns.com.au"
```

Create an R2 API token with Object Read & Write permission scoped to the selected bucket. The public asset origin is the custom domain `https://assets.alibabasigns.com.au`; do not use an `r2.dev` development URL. The S3 endpoint is derived as `https://<account-id>.r2.cloudflarestorage.com` with region `auto`.

Verify listing, writes, public reads, and cleanup:

```powershell
node --env-file=.env.local scripts/r2-check.mjs --all-prefixes --public
```

An `Unauthorized` result means the credentials, account ID, bucket scope, or token permissions do not match; the admin UI reports the same actionable configuration error.

## SMTP email and password reset

Contact submissions and customer password-reset links use the same server-only SMTP transport. The SMTP login is deliberately separate from the public recipient configured in Store Settings.

```env
SMTP_HOST="mail.alibabasigns.com.au"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-mailbox@alibabasigns.com.au"
SMTP_PASSWORD="replace-with-real-password"
SMTP_FROM_EMAIL="your-mailbox@alibabasigns.com.au"
SMTP_FROM_NAME="Ali Baba Signs"
CONTACT_TO_EMAIL="contact@alibabasigns.com.au"
CONTACT_FALLBACK_EMAIL="contact@alibabasigns.com.au"
SMTP_REQUIRE_TLS="true"
SMTP_CONNECTION_TIMEOUT_MS="10000"
SMTP_GREETING_TIMEOUT_MS="10000"
SMTP_SOCKET_TIMEOUT_MS="20000"
```

Port 587 with `SMTP_SECURE=false` uses STARTTLS; providers using implicit TLS commonly specify port 465 with `SMTP_SECURE=true`. Use the exact mode supplied by the mail host. Certificate verification is not disabled. `SMTP_USERNAME` remains accepted as a backwards-compatible alias, but new deployments should use `SMTP_USER`. Contact messages are sent from `SMTP_FROM_EMAIL`, to the admin Store Settings contact email (then the contact environment fallbacks), with the customer address as Reply-To.

## Payments

Store Settings defaults to safe test mode. The checkout test adapter supports Stripe, card through Stripe, and PayPal outcomes without collecting card data.

Environment placeholders for a future live adapter are:

```env
STRIPE_SECRET_KEY="sk_test_or_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_or_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_ENVIRONMENT="sandbox"
```

Do not disable payment test mode merely by adding keys. To enable real transactions, implement provider checkout-session/order creation in `lib/payments`, render Stripe Checkout/Elements or PayPal's hosted buttons, add signed webhook endpoints that update `payment_records` and `orders`, test with Stripe test mode and PayPal Sandbox, and only then switch provider credentials and the Store Settings flag to live mode. Raw card fields must never be added to this application.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node --env-file=.env.local scripts/verify-commerce-db.mjs
```

`verify-commerce-db.mjs` runs inside a rolled-back transaction. `checkout-smoke.mjs` expects a running production server, creates temporary orders for all three payment outcomes, and deletes its fixtures afterward.

## Checkout and Fulfilment Logic

Product prices and quantities are reloaded from the database when an order is created. Banner delivery uses the combined billable printed area: up to 2 m² is AUD 15, 2.1–5 m² is AUD 20, 5.1–10 m² is AUD 28, 10.1–20 m² is AUD 40, and larger jobs start at AUD 55. The bands are stored in Store Settings; products marked **Free shipping** do not contribute to billable shipping area. Other products use the standard shipping cost and free-shipping threshold.

Vouchers test their minimum against product subtotal only. The product discount is applied after eligibility, while shipping and GST continue to use the original product subtotal. Orders retain authoritative price, shipping, tax, address, artwork, and voucher snapshots. Paid orders enter design confirmation, then printing, quality check, dispatch or pickup, and delivery/completion. The first delivered/completed milestone claims one unique email event and sends the customer a delivery message with per-item review links; retries only occur after a recorded failure or stale processing claim.
