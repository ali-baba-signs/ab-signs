import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const migration = process.argv[2] || '2026-08-06-content-assets.sql'
if (!/^2026-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.sql$/.test(migration)) {
  console.error('Migration must be a dated SQL filename from the sql directory.')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Load it through the deployment environment or Node --env-file.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamp not null default now())')
  const applied = await pool.query('select 1 from schema_migrations where name = $1', [migration])
  if (applied.rowCount) {
    console.log(`${migration} is already applied.`)
  } else {
    const sql = await readFile(resolve('sql', migration), 'utf8')
    const transactionStart = sql.search(/^begin;\s*$/im)
    if (transactionStart > -1) {
      const preTransaction = sql.slice(0, transactionStart).trim()
      const transactional = sql.slice(transactionStart).trim()
      // PostgreSQL requires newly added enum values to be committed before
      // they can be used by data updates or defaults in a later transaction.
      if (preTransaction) await pool.query(preTransaction)
      await pool.query(transactional)
    } else {
      await pool.query(sql)
    }
    await pool.query('insert into schema_migrations (name) values ($1)', [migration])
    console.log(`Applied ${migration}.`)
  }
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown database error'}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
