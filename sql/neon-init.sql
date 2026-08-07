-- Ali Baba Signs Neon bootstrap
-- Run this in the Neon SQL editor after setting DATABASE_URL in your app.

create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('admin', 'customer', 'designer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum (
    'pending',
    'confirmed',
    'production',
    'quality_check',
    'ready_to_ship',
    'shipped',
    'delivered',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type product_category as enum (
    'custom_banners',
    'mesh_banners',
    'vinyl_banners',
    'templates',
    'digital_designs'
  );
exception when duplicate_object then null;
end $$;

create table if not exists users (
  id text primary key,
  email varchar(255) not null unique,
  "emailVerified" boolean not null default false,
  name varchar(255) not null,
  image text,
  role user_role not null default 'customer',
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists sessions (
  id text primary key,
  "expiresAt" timestamp not null,
  token text not null unique,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references users(id) on delete cascade
);

create table if not exists account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references users(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  scope text,
  password text,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamp not null,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create index if not exists sessions_user_id_idx on sessions ("userId");
create index if not exists account_user_id_idx on account ("userId");
create index if not exists verification_identifier_idx on verification (identifier);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  company varchar(255),
  phone varchar(20),
  address text,
  city varchar(255),
  state varchar(255),
  postal_code varchar(20),
  country varchar(255),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  label varchar(100) not null default 'Default',
  recipient_name varchar(255) not null,
  phone varchar(30),
  address_line_1 text not null,
  address_line_2 text,
  city varchar(255) not null,
  state varchar(255),
  postal_code varchar(30),
  country varchar(255) not null default 'United States',
  is_default boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  slug varchar(255) not null unique,
  description text,
  category product_category not null,
  created_at timestamp not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references product_categories(id),
  sku varchar(100) not null unique,
  name varchar(255) not null,
  description text,
  base_price numeric(10,2) not null,
  materials jsonb,
  print_types jsonb,
  featured boolean default false,
  active boolean default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name varchar(255) not null,
  dimensions varchar(100),
  material varchar(100),
  print_type varchar(100),
  price_modifier numeric(10,2) default 0,
  stock integer default 0,
  sku varchar(100) unique,
  created_at timestamp not null default now()
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt varchar(255),
  is_primary boolean default false,
  "order" integer default 0,
  created_at timestamp not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  description text,
  thumbnail text,
  canvas_data jsonb not null,
  category product_category,
  tags jsonb,
  created_by text references users(id),
  created_at timestamp not null default now()
);

create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name varchar(255) not null,
  description text,
  canvas_data jsonb not null,
  thumbnail text,
  template_id uuid references templates(id),
  product_id uuid references products(id),
  is_public boolean default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs(id) on delete cascade,
  version integer not null,
  canvas_data jsonb not null,
  changed_at timestamp not null default now(),
  unique (design_id, version)
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  user_id text references users(id) on delete set null,
  quote_number varchar(50) not null unique,
  status varchar(50) not null default 'requested',
  customer_email varchar(255) not null,
  customer_name varchar(255),
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  expires_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id),
  order_number varchar(50) not null unique,
  status order_status not null default 'pending',
  total_amount numeric(12,2) not null,
  tax_amount numeric(10,2) default 0,
  shipping_amount numeric(10,2) default 0,
  shipping_address jsonb,
  notes text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid references product_variants(id),
  design_id uuid references designs(id),
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(12,2) not null,
  specifications jsonb
);

create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  notes text,
  changed_at timestamp not null default now(),
  changed_by text references users(id)
);

create table if not exists artwork_files (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  design_id uuid references designs(id) on delete set null,
  order_item_id uuid references order_items(id) on delete set null,
  file_url text not null,
  file_name varchar(255) not null,
  mime_type varchar(120),
  file_size_bytes bigint,
  proof_status varchar(50) not null default 'pending',
  notes text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists production_queue (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id),
  status varchar(50) not null default 'queued',
  assigned_to text references users(id),
  priority integer default 0,
  started_at timestamp,
  completed_at timestamp,
  notes text,
  created_at timestamp not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code varchar(80) not null unique,
  description text,
  discount_type varchar(20) not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null,
  active boolean not null default true,
  starts_at timestamp,
  ends_at timestamp,
  usage_limit integer,
  used_count integer not null default 0,
  created_at timestamp not null default now()
);

create table if not exists live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id text not null references users(id),
  message text not null,
  is_admin_message boolean default false,
  created_at timestamp not null default now()
);

create table if not exists cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug varchar(255) not null unique,
  title varchar(255) not null,
  content text,
  metadata jsonb,
  published boolean default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists site_reports (
  id uuid primary key default gen_random_uuid(),
  report_type varchar(100) not null,
  date_from date not null,
  date_to date not null,
  payload jsonb not null,
  created_by text references users(id),
  created_at timestamp not null default now()
);

insert into users (id, email, "emailVerified", name, role, "createdAt", "updatedAt")
values
  ('admin_01', 'admin@alibabasigns.com', true, 'Primary Admin', 'admin', now(), now()),
  ('admin_02', 'orders@alibabasigns.com', true, 'Orders Admin', 'admin', now(), now()),
  ('admin_03', 'production@alibabasigns.com', true, 'Production Admin', 'admin', now(), now())
on conflict (email) do update set
  role = excluded.role,
  name = excluded.name,
  "emailVerified" = true,
  "updatedAt" = now();

insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
values
  ('acct_admin_01', 'admin_01', 'credential', 'admin_01', '08078dc0bdb91354ec2f1a4e7d59144c:792ddac0e1b44e3985bf7dc64e7a76bbd492c4b44c7b222523f82db64adca2ab8a9441b45f492d56e84af1794492806abb123f3ea74b94f13979f9623cf6eb0e', now(), now()),
  ('acct_admin_02', 'admin_02', 'credential', 'admin_02', 'fdcbf36a1b4fdcb7058bf5a61ae10d8a:e0b4b1fb6a5bbd6182324d6e9a76c898050ae61147301cc4e6e7f4c359a4efefce9175bc538ea3485cf044a381d61c51d17e702e721a606c365bc644e940247d', now(), now()),
  ('acct_admin_03', 'admin_03', 'credential', 'admin_03', 'd120f60950e55ad1e0254b400379db01:6b07ae7f75bc47664b17367c1497110d65aaa0ed66a302cc5d7fa099b95208568170cdf59beddb223b3c268b147c427725075ca3851622891f431e811fc8d34a', now(), now())
on conflict (id) do update set
  password = excluded.password,
  "updatedAt" = now();

insert into product_categories (name, slug, description, category)
values
  ('Custom Banners', 'custom-banners', 'Custom printed banners for events and storefronts.', 'custom_banners'),
  ('Vinyl Banners', 'vinyl-banners', 'Durable vinyl banners for indoor and outdoor use.', 'vinyl_banners'),
  ('Mesh Banners', 'mesh-banners', 'Wind-friendly mesh banners for fences and outdoor spaces.', 'mesh_banners'),
  ('Design Templates', 'templates', 'Reusable editable design templates.', 'templates')
on conflict (slug) do nothing;

insert into products (category_id, sku, name, description, base_price, materials, print_types, featured)
select id, 'VINYL-3X5', 'Custom Vinyl Banner 3ft x 5ft', 'High-quality vinyl banner with full-color print.', 49.99, '["13oz vinyl","15oz blockout vinyl"]'::jsonb, '["single-sided","double-sided"]'::jsonb, true
from product_categories where slug = 'vinyl-banners'
on conflict (sku) do nothing;

insert into products (category_id, sku, name, description, base_price, materials, print_types, featured)
select id, 'MESH-2X4', 'Mesh Banner 2ft x 4ft', 'Wind-resistant mesh banner for outdoor installs.', 39.99, '["mesh vinyl"]'::jsonb, '["single-sided"]'::jsonb, true
from product_categories where slug = 'mesh-banners'
on conflict (sku) do nothing;

insert into products (category_id, sku, name, description, base_price, materials, print_types, featured)
select id, 'CUSTOM-4X8', 'Premium Custom Banner 4ft x 8ft', 'Large-format banner for storefronts, booths, and events.', 79.99, '["13oz vinyl","18oz vinyl"]'::jsonb, '["single-sided","double-sided"]'::jsonb, true
from product_categories where slug = 'custom-banners'
on conflict (sku) do nothing;

insert into product_variants (product_id, name, dimensions, material, print_type, price_modifier, stock, sku)
select id, 'Standard 3ft x 5ft', '3ft x 5ft', '13oz vinyl', 'single-sided', 0, 999, 'VINYL-3X5-STD'
from products where sku = 'VINYL-3X5'
on conflict (sku) do nothing;

insert into product_variants (product_id, name, dimensions, material, print_type, price_modifier, stock, sku)
select id, 'Standard 2ft x 4ft', '2ft x 4ft', 'mesh vinyl', 'single-sided', 0, 999, 'MESH-2X4-STD'
from products where sku = 'MESH-2X4'
on conflict (sku) do nothing;

insert into product_variants (product_id, name, dimensions, material, print_type, price_modifier, stock, sku)
select id, 'Standard 4ft x 8ft', '4ft x 8ft', '13oz vinyl', 'single-sided', 0, 999, 'CUSTOM-4X8-STD'
from products where sku = 'CUSTOM-4X8'
on conflict (sku) do nothing;

create or replace view admin_dashboard_analytics as
select
  (select count(*) from orders where created_at::date = current_date) as todays_orders,
  (select coalesce(sum(total_amount), 0) from orders where created_at::date = current_date) as todays_revenue,
  (select coalesce(sum(total_amount), 0) from orders) as total_revenue,
  (select count(*) from users where role = 'customer') as total_customers,
  (select count(*) from users u where role = 'customer' and exists (
    select 1 from orders o where o.user_id = u.id group by o.user_id having count(*) > 1
  )) as returning_customers,
  (select coalesce(avg(total_amount), 0) from orders) as average_order_value,
  (select count(*) from artwork_files where proof_status = 'pending') as pending_proofs,
  (select count(*) from production_queue where status in ('queued', 'in_progress')) as production_queue;

create or replace view popular_products as
select
  p.id,
  p.name,
  p.sku,
  coalesce(sum(oi.quantity), 0) as units_sold,
  coalesce(sum(oi.total_price), 0) as revenue
from products p
left join order_items oi on oi.product_id = p.id
group by p.id, p.name, p.sku
order by units_sold desc, revenue desc;

create or replace view top_selling_sizes as
select
  coalesce(pv.dimensions, oi.specifications->>'size', 'Unknown') as size,
  coalesce(sum(oi.quantity), 0) as units_sold
from order_items oi
left join product_variants pv on pv.id = oi.variant_id
group by coalesce(pv.dimensions, oi.specifications->>'size', 'Unknown')
order by units_sold desc;

-- Seeded admin login credentials:
-- URL: /admin/login
-- admin@alibabasigns.com / Admin!2026-01
-- orders@alibabasigns.com / Admin!2026-02
-- production@alibabasigns.com / Admin!2026-03
-- Change these passwords immediately after first login.
