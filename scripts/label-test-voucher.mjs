// import nextEnv from '@next/env'
// import pg from 'pg'
// nextEnv.loadEnvConfig(process.cwd())
// const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000})
// try {
//  const result=await pool.query("update coupons set description = $2 where code = $1 returning id, code, description, discount_type, discount_value, ends_at, usage_limit, per_customer_usage_limit, minimum_subtotal, max_discount_amount")
//  console.log(JSON.stringify(result.rows))
//  if(result.rows[0]) {const scope=await pool.query('select (select count(*) from coupon_products where coupon_id=$1)::int as products, (select count(*) from coupon_categories where coupon_id=$1)::int as categories',[result.rows[0].id]); console.log(JSON.stringify({restrictions:scope.rows[0]}))}
// } finally {await pool.end()}
