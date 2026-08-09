begin;

alter table products add column if not exists size_mode varchar(30) not null default 'preset_sizes';
alter table products add column if not exists allow_custom_dimensions boolean not null default false;
update products set size_mode = case when template_id is not null then 'template_sizes' else coalesce(nullif(size_mode, ''), 'preset_sizes') end;
alter table products drop constraint if exists products_size_mode_check;
alter table products add constraint products_size_mode_check check (size_mode in ('template_sizes','preset_sizes','custom_dimensions','fixed_variants'));

alter table product_sizes add column if not exists variant_type varchar(30);
alter table product_sizes add column if not exists size_group varchar(20);
alter table product_sizes add column if not exists side_mode varchar(10) not null default 'single';
alter table product_sizes drop constraint if exists product_sizes_side_mode_check;
alter table product_sizes add constraint product_sizes_side_mode_check check (side_mode in ('single','double'));
alter table product_sizes drop constraint if exists product_sizes_variant_type_check;
alter table product_sizes add constraint product_sizes_variant_type_check check (variant_type is null or variant_type in ('teardrop','feather'));
alter table product_sizes drop constraint if exists product_sizes_size_group_check;
alter table product_sizes add constraint product_sizes_size_group_check check (size_group is null or size_group in ('small','medium','large'));

alter table template_sizes add column if not exists bleed numeric(10,3) not null default 3 check (bleed >= 0);
alter table template_sizes add column if not exists trim_marks boolean not null default true;

alter table customer_artworks add column if not exists source_width_px integer;
alter table customer_artworks add column if not exists source_height_px integer;
alter table customer_artworks drop constraint if exists customer_artworks_source_dimensions_check;
alter table customer_artworks add constraint customer_artworks_source_dimensions_check check (
  (source_width_px is null and source_height_px is null) or (source_width_px > 0 and source_height_px > 0)
);

commit;
