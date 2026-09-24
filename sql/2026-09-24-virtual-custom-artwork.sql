alter type order_status add value if not exists 'artwork_pending';

begin;
alter table customer_artworks alter column product_id drop not null;
alter table customer_artworks add column if not exists custom_width numeric(12,3);
alter table customer_artworks add column if not exists custom_height numeric(12,3);
alter table customer_artworks add column if not exists custom_unit varchar(2);
alter table customer_artworks drop constraint if exists customer_artworks_custom_dimensions_check;
alter table customer_artworks add constraint customer_artworks_custom_dimensions_check check (
  (custom_width is null and custom_height is null and custom_unit is null)
  or (custom_width > 0 and custom_height > 0 and custom_unit in ('mm', 'cm', 'm', 'in', 'ft'))
);
alter table order_items alter column product_id drop not null;
alter table product_sizes alter column safe_margin set default 5;
alter table template_sizes alter column safe_margin set default 5;
commit;
