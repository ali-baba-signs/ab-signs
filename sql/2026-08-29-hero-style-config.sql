-- Customizable homepage hero typography, button, alignment, and badge styling.
ALTER TABLE hero_slides
  ADD COLUMN IF NOT EXISTS style_config json NOT NULL DEFAULT '{
    "headingColor":"#ffffff",
    "headingSize":72,
    "headingWeight":900,
    "descriptionColor":"#ffffff",
    "descriptionSize":18,
    "buttonColor":"#ed1b68",
    "buttonTextColor":"#ffffff",
    "textAlignment":"left",
    "eyebrowColor":"#ffffff",
    "eyebrowBackgroundColor":"#ed1b68",
    "eyebrowSize":12,
    "eyebrowWeight":700,
    "eyebrowRadius":999
  }'::json;
