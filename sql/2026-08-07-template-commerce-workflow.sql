-- Dynamic templates/categories, cached conversion metadata, private customer
-- artwork, template-owned sizes, order milestones, addresses, and reviews.

alter type order_status add value if not exists 'pending_design_confirmation';
alter type order_status add value if not exists 'design_revision_required';
alter type order_status add value if not exists 'design_confirmed';
alter type order_status add value if not exists 'awaiting_payment_confirmation';
alter type order_status add value if not exists 'payment_confirmed';
alter type order_status add value if not exists 'order_confirmed';
alter type order_status add value if not exists 'in_production';
alter type order_status add value if not exists 'quality_check';
alter type order_status add value if not exists 'print_ready';
alter type order_status add value if not exists 'ready_for_pickup';
alter type order_status add value if not exists 'awaiting_dispatch';
alter type order_status add value if not exists 'out_for_delivery';
alter type order_status add value if not exists 'completed';
alter type order_status add value if not exists 'on_hold';
alter type order_status add value if not exists 'refund_requested';
alter type order_status add value if not exists 'refunded';

begin;

alter table templates add column if not exists svg_checksum varchar(64);
alter table templates add column if not exists conversion_version integer not null default 1;
alter table templates add column if not exists conversion_status varchar(20) not null default 'pending';
alter table templates add column if not exists conversion_error text;
alter table templates add column if not exists generated_at timestamp;
alter table templates drop constraint if exists templates_conversion_status_check;
alter table templates add constraint templates_conversion_status_check check (conversion_status in ('pending','processing','ready','failed'));
update templates set conversion_status = case when canvas_data is not null and jsonb_array_length(coalesce(canvas_data::jsonb->'objects','[]'::jsonb)) > 0 then 'ready' else 'pending' end,
  generated_at = case when canvas_data is not null then coalesce(generated_at, updated_at) else generated_at end;

create table if not exists template_sizes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  label varchar(120) not null,
  width numeric(12,3) not null check (width > 0),
  height numeric(12,3) not null check (height > 0),
  unit varchar(10) not null default 'mm' check (unit in ('mm','cm','in','ft','m')),
  fit_mode varchar(10) not null default 'contain' check (fit_mode in ('contain','cover','stretch')),
  safe_margin numeric(10,3) not null default 0 check (safe_margin >= 0),
  enabled boolean not null default true,
  is_default boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(template_id, width, height, unit)
);
create index if not exists template_sizes_template_idx on template_sizes(template_id);
create unique index if not exists template_sizes_one_default_idx on template_sizes(template_id) where is_default;

insert into template_sizes (template_id, label, width, height, unit, is_default)
select id, trim(to_char(physical_width, 'FM999999990.###')) || ' x ' || trim(to_char(physical_height, 'FM999999990.###')) || ' ' || coalesce(measurement_unit,'mm'),
  physical_width, physical_height, coalesce(measurement_unit,'mm'), true
from templates t
where physical_width > 0 and physical_height > 0
  and not exists (select 1 from template_sizes ts where ts.template_id = t.id);

create table if not exists product_template_size_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  template_size_id uuid not null references template_sizes(id) on delete cascade,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  enabled boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(product_id, template_size_id)
);
create index if not exists product_template_size_prices_product_idx on product_template_size_prices(product_id);
insert into product_template_size_prices (product_id, template_size_id, unit_price)
select p.id, ts.id, coalesce(ps.unit_price, p.base_price)
from products p join template_sizes ts on ts.template_id = p.template_id
left join lateral (
  select unit_price from product_sizes s where s.product_id = p.id and s.enabled order by s.sort_order limit 1
) ps on true
on conflict (product_id, template_size_id) do nothing;

alter table product_categories add column if not exists image_asset_id uuid references storage_assets(id) on delete restrict;
alter table product_categories add column if not exists enabled boolean not null default true;
alter table product_categories add column if not exists show_on_homepage boolean not null default false;
alter table product_categories add column if not exists display_order integer not null default 0;
alter table product_categories add column if not exists updated_at timestamp not null default now();
alter table product_categories drop constraint if exists product_categories_display_order_check;
alter table product_categories add constraint product_categories_display_order_check check (display_order >= 0);
create index if not exists product_categories_homepage_idx on product_categories(show_on_homepage, enabled, display_order);

alter table user_profiles add column if not exists alternate_phone varchar(20);
alter table user_profiles add column if not exists delivery_instructions text;
create unique index if not exists user_profiles_user_idx on user_profiles(user_id);

alter table designs add column if not exists asset_id uuid references storage_assets(id) on delete restrict;
create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(), user_id text not null references users(id) on delete cascade,
  label varchar(80) not null default 'Address', full_name varchar(255) not null, phone varchar(30), alternate_phone varchar(30),
  address_line_1 text not null, address_line_2 text, city varchar(160) not null, region varchar(160), postal_code varchar(30) not null,
  country varchar(160) not null, delivery_instructions text, default_shipping boolean not null default false,
  default_billing boolean not null default false, created_at timestamp not null default now(), updated_at timestamp not null default now()
);
-- Older deployments already have customer_addresses with recipient_name,
-- state, and is_default. Upgrade that table in place without dropping data.
alter table customer_addresses add column if not exists full_name varchar(255);
alter table customer_addresses add column if not exists alternate_phone varchar(30);
alter table customer_addresses add column if not exists region varchar(160);
alter table customer_addresses add column if not exists delivery_instructions text;
alter table customer_addresses add column if not exists default_shipping boolean not null default false;
alter table customer_addresses add column if not exists default_billing boolean not null default false;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name='recipient_name') then
    execute $statement$update customer_addresses set full_name = coalesce(nullif(full_name, ''), recipient_name, 'Customer') where full_name is null or full_name = ''$statement$;
    execute 'alter table customer_addresses alter column recipient_name drop not null';
  else
    update customer_addresses set full_name = 'Customer' where full_name is null or full_name = '';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name='state') then
    execute 'update customer_addresses set region = state where region is null and state is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name='is_default') then
    execute 'update customer_addresses set default_shipping = is_default, default_billing = is_default where is_default';
    execute 'alter table customer_addresses alter column is_default set default false';
  end if;
end $$;
update customer_addresses set full_name = 'Customer' where full_name is null or full_name = '';
alter table customer_addresses alter column full_name set not null;
update customer_addresses set postal_code = '' where postal_code is null;
alter table customer_addresses alter column postal_code set not null;
with ranked as (select id, row_number() over(partition by user_id order by updated_at desc, created_at desc, id) position from customer_addresses where default_shipping)
update customer_addresses set default_shipping=false where id in (select id from ranked where position > 1);
with ranked as (select id, row_number() over(partition by user_id order by updated_at desc, created_at desc, id) position from customer_addresses where default_billing)
update customer_addresses set default_billing=false where id in (select id from ranked where position > 1);
create index if not exists customer_addresses_user_idx on customer_addresses(user_id);
create unique index if not exists customer_addresses_default_shipping_idx on customer_addresses(user_id) where default_shipping;
create unique index if not exists customer_addresses_default_billing_idx on customer_addresses(user_id) where default_billing;

create table if not exists customer_artworks (
  id uuid primary key default gen_random_uuid(), user_id text not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  template_size_id uuid references template_sizes(id) on delete restrict,
  product_size_id uuid references product_sizes(id) on delete restrict,
  asset_id uuid not null references storage_assets(id) on delete restrict,
  original_filename varchar(255) not null, notes text, orientation varchar(20), quantity_reference integer,
  status varchar(20) not null default 'ready', created_at timestamp not null default now(), updated_at timestamp not null default now(),
  check (orientation is null or orientation in ('portrait','landscape','unspecified')),
  check (quantity_reference is null or quantity_reference between 1 and 1000)
);
create index if not exists customer_artworks_user_idx on customer_artworks(user_id);
create index if not exists customer_artworks_product_idx on customer_artworks(product_id);

alter table orders alter column status set default 'pending_design_confirmation';
update orders set status = case status
  when 'pending' then 'pending_design_confirmation'::order_status
  when 'confirmed' then 'order_confirmed'::order_status
  when 'production' then 'in_production'::order_status
  when 'ready_to_ship' then 'awaiting_dispatch'::order_status
  when 'shipped' then 'out_for_delivery'::order_status
  else status end
where status in ('pending','confirmed','production','ready_to_ship','shipped');
alter table orders add column if not exists design_confirmation_deadline timestamp;
alter table orders add column if not exists design_confirmed_at timestamp;
alter table orders add column if not exists design_confirmation_on_time boolean;
alter table orders add column if not exists design_delay_reason text;
alter table orders add column if not exists expected_printing_at timestamp;
alter table orders add column if not exists expected_delivery_at timestamp;
alter table orders add column if not exists courier_name varchar(120);
alter table orders add column if not exists tracking_number varchar(160);
alter table orders add column if not exists internal_notes text;
alter table orders add column if not exists customer_notes text;
alter table orders add column if not exists receipt_asset_id uuid references storage_assets(id) on delete restrict;
update orders set design_confirmation_deadline = created_at + interval '6 hours' where design_confirmation_deadline is null;

alter table order_items add column if not exists template_size_id uuid references template_sizes(id) on delete set null;
alter table order_items add column if not exists customer_artwork_id uuid references customer_artworks(id) on delete set null;
alter table order_items add column if not exists design_source varchar(30) not null default 'design_assistance';
alter table order_items drop constraint if exists order_items_design_source_check;
alter table order_items add constraint order_items_design_source_check check (design_source in ('online_editor','customer_upload','design_assistance'));

alter table order_status_history add column if not exists previous_status order_status;
alter table order_status_history add column if not exists new_status order_status;
alter table order_status_history add column if not exists internal_note text;
alter table order_status_history add column if not exists customer_visible_note text;
alter table order_status_history add column if not exists expected_completion_at timestamp;
alter table order_status_history add column if not exists changed_by_admin text references admin_users(id) on delete set null;
update order_status_history set new_status = status where new_status is null;
update order_status_history set status = case status
  when 'pending' then 'pending_design_confirmation'::order_status when 'confirmed' then 'order_confirmed'::order_status
  when 'production' then 'in_production'::order_status when 'ready_to_ship' then 'awaiting_dispatch'::order_status
  when 'shipped' then 'out_for_delivery'::order_status else status end
where status in ('pending','confirmed','production','ready_to_ship','shipped');
update order_status_history set previous_status = case previous_status
  when 'pending' then 'pending_design_confirmation'::order_status when 'confirmed' then 'order_confirmed'::order_status
  when 'production' then 'in_production'::order_status when 'ready_to_ship' then 'awaiting_dispatch'::order_status
  when 'shipped' then 'out_for_delivery'::order_status else previous_status end
where previous_status in ('pending','confirmed','production','ready_to_ship','shipped');
update order_status_history set new_status = case new_status
  when 'pending' then 'pending_design_confirmation'::order_status when 'confirmed' then 'order_confirmed'::order_status
  when 'production' then 'in_production'::order_status when 'ready_to_ship' then 'awaiting_dispatch'::order_status
  when 'shipped' then 'out_for_delivery'::order_status else new_status end
where new_status in ('pending','confirmed','production','ready_to_ship','shipped');
create index if not exists order_status_history_order_time_idx on order_status_history(order_id, changed_at);

create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null unique references order_items(id) on delete cascade,
  user_id text not null references users(id) on delete cascade, product_id uuid not null references products(id) on delete cascade,
  product_quality integer not null check (product_quality between 1 and 5), print_quality integer not null check (print_quality between 1 and 5),
  timeliness integer not null check (timeliness between 1 and 5), service integer not null check (service between 1 and 5),
  overall integer not null check (overall between 1 and 5), feedback text, verified_purchase boolean not null default true,
  moderation_status varchar(20) not null default 'pending' check (moderation_status in ('pending','published','hidden')),
  moderated_by text references admin_users(id) on delete set null, moderated_at timestamp,
  created_at timestamp not null default now(), updated_at timestamp not null default now()
);
create index if not exists product_reviews_product_idx on product_reviews(product_id);

commit;
