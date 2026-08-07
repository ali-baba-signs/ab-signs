-- Admin commerce, editable templates, checkout and activity audit migration.
-- Apply after neon-init.sql and admin-auth-init.sql.

begin;

alter table templates add column if not exists preview_image_url text;
alter table templates add column if not exists preview_image_key text;
alter table templates add column if not exists webm_url text;
alter table templates add column if not exists webm_key text;
alter table templates add column if not exists json_url text;
alter table templates add column if not exists json_key text;
alter table templates add column if not exists svg_url text;
alter table templates add column if not exists svg_key text;
alter table templates add column if not exists status varchar(30) not null default 'draft';
alter table templates add column if not exists updated_at timestamp not null default now();

alter table products add column if not exists template_id uuid references templates(id) on delete set null;
alter table product_images add column if not exists storage_key text;

create table if not exists product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label varchar(120) not null,
  width numeric(10,2),
  height numeric(10,2),
  unit varchar(20) not null default 'in',
  unit_price numeric(10,2) not null check (unit_price >= 0),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists product_sizes_product_idx on product_sizes(product_id);

alter table orders alter column user_id drop not null;
alter table orders add column if not exists payment_status varchar(30) not null default 'awaiting_payment';
alter table orders add column if not exists payment_method varchar(30);
alter table orders add column if not exists currency varchar(3) not null default 'AUD';
alter table orders add column if not exists customer_email varchar(255);
alter table orders add column if not exists idempotency_key varchar(100);
alter table orders add column if not exists billing_address jsonb;
update orders set customer_email = coalesce(customer_email, 'legacy-order@invalid.local');
update orders set idempotency_key = coalesce(idempotency_key, 'legacy-' || id::text);
alter table orders alter column customer_email set not null;
alter table orders alter column idempotency_key set not null;
create unique index if not exists orders_idempotency_key_idx on orders(idempotency_key);

alter table order_items add column if not exists product_size_id uuid references product_sizes(id) on delete set null;
alter table order_items add column if not exists template_id uuid references templates(id);

create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider varchar(30) not null check (provider in ('stripe', 'card', 'paypal')),
  mode varchar(20) not null default 'test' check (mode in ('test', 'live')),
  status varchar(30) not null default 'awaiting_payment',
  amount numeric(12,2) not null,
  currency varchar(3) not null,
  external_id varchar(255),
  metadata jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists payment_records_order_idx on payment_records(order_id);

create table if not exists store_settings (
  id varchar(30) primary key default 'default',
  values jsonb not null,
  updated_by text references admin_users(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id text references admin_users(id) on delete set null,
  admin_name varchar(255) not null,
  action_type varchar(80) not null,
  entity_type varchar(80) not null,
  entity_id text,
  entity_name varchar(255),
  description text not null,
  metadata jsonb,
  created_at timestamp not null default now()
);
create index if not exists admin_activity_created_idx on admin_activity_logs(created_at desc);
create index if not exists admin_activity_entity_idx on admin_activity_logs(entity_type, entity_id);

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  email varchar(255) not null,
  phone varchar(30),
  subject varchar(255) not null,
  message text not null,
  status varchar(30) not null default 'new',
  created_at timestamp not null default now()
);
create index if not exists contact_submissions_created_idx on contact_submissions(created_at desc);

insert into product_categories (name, slug, description, category)
values
  ('Custom Banners', 'custom-banners', 'Made-to-order custom signage.', 'custom_banners'),
  ('Mesh Banners', 'mesh-banners', 'Wind-resistant mesh signage.', 'mesh_banners'),
  ('Vinyl Banners', 'vinyl-banners', 'Durable indoor and outdoor vinyl banners.', 'vinyl_banners'),
  ('Templates', 'templates', 'Editable design templates.', 'templates'),
  ('Digital Designs', 'digital-designs', 'Digital-only design products.', 'digital_designs')
on conflict (slug) do nothing;

insert into store_settings (id, values)
values ('default', '{"storeName":"Ali Baba Signs","storeEmail":"support@alibabasigns.com","storePhone":"","address":"","currency":"AUD","taxRate":10,"shippingCost":0,"freeShippingThreshold":50,"turnaroundDays":"3-5","footerText":"Custom print and signage for Australia.","termsUrl":"/terms-of-service","privacyUrl":"/privacy-policy","allowGuestCheckout":true,"paymentTestMode":true}'::jsonb)
on conflict (id) do nothing;

commit;
