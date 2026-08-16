# Ali Baba Signs

## Local Setup

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="use-a-real-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
```

For production, set `BETTER_AUTH_URL` to the real website domain.

Next.js loads env files into `process.env`. For local development, `.env.local`
overrides `.env`. Do not use `process.env.local`; that object does not exist
and will crash the app. After editing `.env.local`, restart the dev server.

For deployment, configure these values in the hosting provider's environment
variables because `.env.local` is local-only and should not be deployed:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="production-random-secret"
BETTER_AUTH_URL="https://your-real-domain.com"
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
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://assets.example.com"
```

Create an R2 API token with Object Read & Write permission scoped to the selected bucket. Attach a public custom domain (recommended) or R2 public development URL to that bucket and use it as `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`. The S3 endpoint is derived as `https://<account-id>.r2.cloudflarestorage.com` with region `auto`.

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
