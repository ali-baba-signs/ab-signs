import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const state = await pool.query(`
    select
      exists(select 1 from information_schema.columns where table_name='templates' and column_name='conversion_status') conversion_status,
      exists(select 1 from information_schema.tables where table_name='template_sizes') template_sizes,
      exists(select 1 from information_schema.tables where table_name='customer_artworks') customer_artworks,
      exists(select 1 from information_schema.columns where table_name='orders' and column_name='design_confirmation_deadline') order_deadline,
      exists(select 1 from information_schema.tables where table_name='product_reviews') product_reviews,
      exists(select 1 from schema_migrations where name='2026-08-07-template-commerce-workflow.sql') migration_record
  `)
  const enumValues = await pool.query(`select enumlabel from pg_enum join pg_type on pg_type.oid=pg_enum.enumtypid where typname='order_status' order by enumsortorder`)
  const columns = await pool.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name in ('customer_addresses','order_status_history','user_profiles','designs')
    order by table_name, ordinal_position
  `)
  console.log(JSON.stringify({ ...state.rows[0], orderStatus: enumValues.rows.map((row) => row.enumlabel), existingColumns: columns.rows }, null, 2))
} finally {
  await pool.end()
}
