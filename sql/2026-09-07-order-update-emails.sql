BEGIN;

ALTER TABLE order_email_events
  ADD COLUMN IF NOT EXISTS dedupe_key varchar(120) NOT NULL DEFAULT 'lifecycle',
  ADD COLUMN IF NOT EXISTS payload jsonb;

DROP INDEX IF EXISTS order_email_events_unique;
CREATE UNIQUE INDEX order_email_events_unique
  ON order_email_events(order_id, event_type, dedupe_key);

COMMIT;
