BEGIN;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id varchar(255) PRIMARY KEY,
  event_type varchar(120) NOT NULL,
  object_id varchar(255),
  processed_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  provider_message_id varchar(500),
  error text,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_email_events_unique ON order_email_events(order_id, event_type);
CREATE INDEX IF NOT EXISTS order_email_events_status_idx ON order_email_events(status, updated_at);

-- Keep the newest payment row for each provider/order before enforcing the
-- one-PaymentIntent-per-order invariant.
DELETE FROM payment_records older
USING payment_records newer
WHERE older.order_id = newer.order_id
  AND older.provider = newer.provider
  AND (older.created_at < newer.created_at OR (older.created_at = newer.created_at AND older.id < newer.id));

CREATE UNIQUE INDEX IF NOT EXISTS payment_records_order_provider_unique ON payment_records(order_id, provider);
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_external_unique ON payment_records(external_id) WHERE external_id IS NOT NULL;

COMMIT;
