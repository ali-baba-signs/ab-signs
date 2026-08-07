const rawPath = process.env.NEXT_PUBLIC_ADMIN_ENTRY_PATH || 'staff-portal'
export const ADMIN_ENTRY_PATH = rawPath.replace(/^\/+|\/+$/g, '') || 'staff-portal'

export function adminPath(suffix = '') {
  const normalized = suffix && !suffix.startsWith('/') ? `/${suffix}` : suffix
  return `/${ADMIN_ENTRY_PATH}${normalized}`
}
