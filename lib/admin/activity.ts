import 'server-only'

import type { AdminSession } from '@/lib/auth/require-admin'

export interface ActivityInput {
  actionType: string
  entityType: string
  entityId?: string | null
  entityName?: string | null
  description: string
  metadata?: Record<string, unknown> | null
}

const secretPattern = /secret|password|token|credential|api.?key|authorization/i

function safeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !secretPattern.test(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value]),
  )
}

export function activityValues(session: AdminSession, input: ActivityInput) {
  return {
    adminUserId: session.user.id,
    adminName: session.user.name || session.user.email,
    actionType: input.actionType.slice(0, 80),
    entityType: input.entityType.slice(0, 80),
    entityId: input.entityId ?? null,
    entityName: input.entityName?.slice(0, 255) ?? null,
    description: input.description.slice(0, 1000),
    metadata: safeMetadata(input.metadata),
  }
}
