import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { pool } from '@/lib/db/client'

const BETTER_AUTH_PASSWORD_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{128}$/i
const EXPLICIT_PLAINTEXT_PREFIX = 'plain$'
const MAX_LEGACY_PASSWORD_LENGTH = 256

type MigrationResult = 'not-legacy' | 'migrated' | 'invalid-legacy-password'

type AdminCredentialRow = {
  id: string
  password: string | null
}

function constantTimeMatches(left: string, right: string) {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest()
  const rightDigest = createHash('sha256').update(right, 'utf8').digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

/**
 * One-time bridge for an admin credential provisioned directly in SQL.
 *
 * Better Auth hashes new passwords itself. This bridge exists only for a
 * bootstrap/reset value entered in admin_accounts.password as plain text (or
 * as `plain$<password>`). On the first successful match it is replaced with
 * Better Auth's current password hash before Better Auth handles the login.
 */
export async function migrateAdminPlaintextPassword(
  email: string,
  submittedPassword: string,
): Promise<MigrationResult> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !submittedPassword) return 'not-legacy'

  const result = await pool.query<AdminCredentialRow>(
    `SELECT account.id, account.password
       FROM admin_accounts AS account
       JOIN admin_users AS admin_user ON admin_user.id = account."userId"
      WHERE lower(admin_user.email) = $1
        AND account."providerId" = 'credential'
      ORDER BY account."updatedAt" DESC
      LIMIT 1`,
    [normalizedEmail],
  )

  const credential = result.rows[0]
  const storedPassword = credential?.password
  if (!credential || !storedPassword || BETTER_AUTH_PASSWORD_PATTERN.test(storedPassword)) {
    return 'not-legacy'
  }

  const plaintext = storedPassword.startsWith(EXPLICIT_PLAINTEXT_PREFIX)
    ? storedPassword.slice(EXPLICIT_PLAINTEXT_PREFIX.length)
    : storedPassword

  if (
    !plaintext
    || plaintext.length > MAX_LEGACY_PASSWORD_LENGTH
    || !constantTimeMatches(plaintext, submittedPassword)
  ) {
    return 'invalid-legacy-password'
  }

  const passwordHash = await hashPassword(submittedPassword)
  await pool.query(
    `UPDATE admin_accounts
        SET password = $1, "updatedAt" = now()
      WHERE id = $2 AND password = $3`,
    [passwordHash, credential.id, storedPassword],
  )

  return 'migrated'
}
