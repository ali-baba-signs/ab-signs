-- Existing free_shipping=true stays free; NULL custom amount uses global rules.
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_shipping_amount numeric(12,2)
  CHECK (custom_shipping_amount IS NULL OR custom_shipping_amount >= 0);
COMMIT;
