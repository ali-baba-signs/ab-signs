import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Initialize the connection pool - shared with Better Auth
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Create and export the database instance
export const db = drizzle(pool, { schema })

export type Database = typeof db
