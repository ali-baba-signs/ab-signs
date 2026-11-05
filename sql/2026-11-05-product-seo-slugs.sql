begin;

alter table products add column if not exists slug varchar(255) not null default '';
alter table products add column if not exists seo_noindex boolean not null default false;

-- Slugs are assigned once. Renaming a product preserves its public URL.
-- A transaction lock serializes competing inserts with the same name.
create or replace function assign_product_slug() returns trigger language plpgsql as $$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  if nullif(new.slug, '') is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(781234009);
  base_slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
  base_slug := left(base_slug, 240);
  if base_slug = '' then base_slug := 'product-' || left(new.id::text, 8); end if;
  -- The public catalogue also has static custom-quote IDs in this namespace.
  if base_slug like 'custom-quote-%' then base_slug := 'product-' || left(base_slug, 232); end if;
  if base_slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    base_slug := 'product-' || base_slug;
  end if;
  candidate := base_slug;
  while exists (select 1 from products where slug = candidate and id <> new.id) loop
    candidate := left(base_slug, 240) || '-' || suffix;
    suffix := suffix + 1;
  end loop;
  new.slug := candidate;
  return new;
end $$;

drop trigger if exists products_assign_slug on products;
create trigger products_assign_slug before insert or update of slug on products
for each row execute function assign_product_slug();

-- Deterministic order makes duplicate-name suffixes stable during backfill.
do $$ declare product_row record; begin
  for product_row in select id from products where slug = '' order by created_at, id loop
    update products set slug = '' where id = product_row.id;
  end loop;
end $$;

create unique index if not exists products_slug_unique_idx on products (slug);
commit;
