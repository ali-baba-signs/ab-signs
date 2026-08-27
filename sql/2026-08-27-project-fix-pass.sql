-- Project fix pass: per-product shipping override.
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;
