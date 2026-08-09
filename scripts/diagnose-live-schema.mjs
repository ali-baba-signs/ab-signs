import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const [columns, constraints, migrations] = await Promise.all([
    pool.query("select column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position"),
    pool.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='orders'::regclass order by conname"),
    pool.query('select name,applied_at from schema_migrations order by applied_at'),
  ])
  console.log(JSON.stringify({ columns: columns.rows, constraints: constraints.rows, migrations: migrations.rows }, null, 2))
} finally {
  await pool.end()
}
