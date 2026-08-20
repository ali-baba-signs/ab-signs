BEGIN;
CREATE TABLE IF NOT EXISTS coupon_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','redeemed','released')),
  expires_at timestamp NOT NULL,
  released_at timestamp,
  release_reason varchar(80),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coupon_reservations_expiry_idx ON coupon_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS coupon_reservations_customer_idx ON coupon_reservations(coupon_id, user_id);
INSERT INTO coupon_reservations (coupon_id, user_id, order_id, expires_at)
SELECT coupon_id, user_id, id, created_at + interval '30 minutes'
FROM orders
WHERE coupon_id IS NOT NULL AND payment_status IN ('awaiting_payment','processing','payment_failed')
ON CONFLICT (order_id) DO NOTHING;
UPDATE coupons
SET reserved_count = (
  SELECT count(*)::integer FROM coupon_reservations
  WHERE coupon_reservations.coupon_id = coupons.id AND coupon_reservations.status = 'reserved'
);
COMMIT;
