export type UserRole = 'admin' | 'customer' | 'designer'

export function getUserRole(user: unknown): UserRole | undefined {
  const role = (user as { role?: unknown } | null | undefined)?.role

  if (role === 'admin' || role === 'customer' || role === 'designer') {
    return role
  }

  return undefined
}
