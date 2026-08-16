alter type order_status add value if not exists 'awaiting_payment';
alter type order_status add value if not exists 'queued_for_printing';
alter type order_status add value if not exists 'printing';
alter type order_status add value if not exists 'printing_completed';
alter type order_status add value if not exists 'production_completed';
alter type order_status add value if not exists 'ready_for_dispatch';
alter type order_status add value if not exists 'dispatched';

begin;

alter table product_sizes
  add column if not exists assembled_height_description varchar(255),
  add column if not exists front_template_id uuid,
  add column if not exists back_template_id uuid;

do $$ begin
  alter table product_sizes add constraint product_sizes_front_template_id_templates_id_fk foreign key (front_template_id) references templates(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table product_sizes add constraint product_sizes_back_template_id_templates_id_fk foreign key (back_template_id) references templates(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table orders
  add column if not exists delivery_type varchar(20) not null default 'delivery',
  add column if not exists dispatched_at timestamp,
  add column if not exists delivered_at timestamp,
  add column if not exists expected_pickup_at timestamp,
  add column if not exists ready_for_pickup_at timestamp,
  add column if not exists pickup_completed_at timestamp,
  add column if not exists policies_accepted boolean not null default false,
  add column if not exists policies_accepted_at timestamp,
  add column if not exists policy_acceptance jsonb;

alter table order_status_history
  add column if not exists actual_completion_at timestamp;

alter table product_reviews
  add column if not exists order_id uuid,
  add column if not exists colour_finish_quality integer;

update product_reviews reviews
set order_id = items.order_id,
    colour_finish_quality = coalesce(reviews.colour_finish_quality, reviews.print_quality)
from order_items items
where reviews.order_item_id = items.id and (reviews.order_id is null or reviews.colour_finish_quality is null);

alter table product_reviews alter column order_id set not null;
alter table product_reviews alter column colour_finish_quality set not null;
do $$ begin
  alter table product_reviews add constraint product_reviews_order_id_orders_id_fk foreign key (order_id) references orders(id) on delete cascade;
exception when duplicate_object then null; end $$;
create index if not exists product_reviews_order_idx on product_reviews(order_id);

alter table contact_submissions
  add column if not exists company varchar(255),
  add column if not exists order_number varchar(80),
  add column if not exists enquiry_type varchar(80),
  add column if not exists email_status varchar(30) not null default 'pending',
  add column if not exists email_error text,
  add column if not exists ip_hash varchar(64),
  add column if not exists user_agent varchar(500),
  add column if not exists read_at timestamp,
  add column if not exists resolved_at timestamp,
  add column if not exists updated_at timestamp not null default now();
create index if not exists contact_submissions_ip_created_idx on contact_submissions(ip_hash, created_at);

create table if not exists policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug varchar(120) not null,
  title varchar(255) not null,
  version varchar(40) not null,
  content jsonb not null,
  published boolean not null default true,
  effective_at timestamp not null default now(),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint policy_documents_slug_version_unique unique(slug, version)
);
create index if not exists policy_documents_published_idx on policy_documents(slug, published, effective_at);

commit;
