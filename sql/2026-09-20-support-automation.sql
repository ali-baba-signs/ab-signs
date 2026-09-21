BEGIN;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS support_payload json;
COMMIT;
