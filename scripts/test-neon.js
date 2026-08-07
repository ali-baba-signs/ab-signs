const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName)

  if (!fs.existsSync(filePath)) return

  const envText = fs.readFileSync(filePath, 'utf8')

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue

    const value = match[2].replace(/^['"]|['"]$/g, '')
    process.env[match[1]] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const requiredTables = ['users', 'sessions', 'account', 'verification', 'products', 'orders']

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from .env.local or .env')
  }

  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET === 'generate-a-32-byte-random-secret'
  ) {
    console.warn('WARN BETTER_AUTH_SECRET is missing or still using the placeholder.')
  }

  if (!process.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL.includes('your-domain.com')) {
    console.warn('WARN BETTER_AUTH_URL is missing or still using the placeholder.')
    console.warn('WARN For local dev use BETTER_AUTH_URL="http://localhost:3000".')
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const connection = await pool.query(
      'select current_database() as database, current_user as user, now() as server_time'
    )
    console.log('OK Connected to Neon')
    console.log(`Database: ${connection.rows[0].database}`)
    console.log(`User: ${connection.rows[0].user}`)
    console.log(`Server time: ${connection.rows[0].server_time.toISOString()}`)

    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema = 'public'"
    )
    const tableNames = new Set(tables.rows.map((row) => row.table_name))
    const missingTables = requiredTables.filter((table) => !tableNames.has(table))

    if (missingTables.length > 0) {
      console.error(`FAIL Missing tables: ${missingTables.join(', ')}`)
      console.error('Run sql/neon-init.sql in the Neon SQL editor, then test again.')
      process.exitCode = 1
      return
    }

    console.log('OK Required tables exist')

    const adminCount = await pool.query(
      "select count(*)::int as count from users where role = 'admin'"
    )
    console.log(`Admin users: ${adminCount.rows[0].count}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('FAIL Neon test failed')
  console.error(error.message || error)
  process.exit(1)
})
