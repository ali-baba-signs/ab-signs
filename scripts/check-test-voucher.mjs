// import nextEnv from '@next/env'
// import pg from 'pg'
// nextEnv.loadEnvConfig(process.cwd())
// const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000})
// try { const result=await pool.query("select code, description, discount_type, discount_value, active, ends_at, usage_limit, per_customer_usage_limit from coupons where code = $100000000000000000",['DEVANTU99B']); console.log(JSON.stringify(result.rows)) } finally {await pool.end()}
