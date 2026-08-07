-- R2 asset registry, managed homepage heroes, custom categories, and
-- deterministic SVG template editor metadata.

begin;

create table if not exists storage_assets (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  filename varchar(255) not null,
  folder text not null,
  content_type varchar(160) not null,
  size_bytes integer not null default 0 check (size_bytes >= 0),
  etag varchar(255),
  access varchar(20) not null default 'public' check (access in ('public', 'private')),
  status varchar(30) not null default 'available' check (status in ('available', 'inaccessible', 'malformed', 'missing')),
  uploaded_by text references admin_users(id) on delete set null,
  uploaded_at timestamp not null default now(),
  last_seen_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists storage_assets_folder_idx on storage_assets(folder);
create index if not exists storage_assets_seen_idx on storage_assets(last_seen_at desc);

alter table product_images add column if not exists asset_id uuid references storage_assets(id) on delete restrict;
create index if not exists product_images_asset_idx on product_images(asset_id);

alter table templates add column if not exists preview_asset_id uuid references storage_assets(id) on delete restrict;
alter table templates add column if not exists svg_asset_id uuid references storage_assets(id) on delete restrict;
alter table templates add column if not exists physical_width numeric(12,3);
alter table templates add column if not exists physical_height numeric(12,3);
alter table templates add column if not exists measurement_unit varchar(10) default 'mm';
alter table templates add column if not exists logical_canvas_width integer;
alter table templates add column if not exists logical_canvas_height integer;
alter table templates add column if not exists scale_metadata jsonb;
alter table templates add column if not exists template_version integer not null default 1;
create index if not exists templates_preview_asset_idx on templates(preview_asset_id);
create index if not exists templates_svg_asset_idx on templates(svg_asset_id);

create table if not exists hero_slides (
  id uuid primary key default gen_random_uuid(),
  desktop_asset_id uuid not null references storage_assets(id) on delete restrict,
  mobile_asset_id uuid references storage_assets(id) on delete restrict,
  title varchar(255),
  description text,
  eyebrow varchar(255),
  button_label varchar(120),
  button_url text,
  alt_text varchar(255) not null,
  horizontal_alignment varchar(10) not null default 'left' check (horizontal_alignment in ('left', 'center', 'right')),
  vertical_alignment varchar(10) not null default 'middle' check (vertical_alignment in ('top', 'middle', 'bottom')),
  featured boolean not null default true,
  enabled boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists hero_slides_display_idx on hero_slides(featured, enabled, display_order);

-- Product categories remain normalized. Custom names use the existing general
-- custom_banners classification while retaining their own unique name/slug.
create unique index if not exists product_categories_lower_name_idx on product_categories(lower(name));

commit;
