import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, storeSettings } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { DEFAULT_STORE_SETTINGS, publicConfigurationStatus, validateStoreSettings, type StoreSettingsValues } from '@/lib/store/settings'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1)
    const settings = { ...DEFAULT_STORE_SETTINGS, ...(row?.values as Partial<StoreSettingsValues> | undefined) }
    return NextResponse.json({ data: { settings, configuration: publicConfigurationStatus(settings) } })
  } catch (error) {
    console.error('Settings load failed', error)
    return NextResponse.json({ error: { code: 'SETTINGS_LOAD_FAILED', message: 'Settings could not be loaded. Apply the latest database migration and try again.' } }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const settings = validateStoreSettings(await request.json())
    const [previous] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1)
    const previousValues = { ...DEFAULT_STORE_SETTINGS, ...(previous?.values as Partial<StoreSettingsValues> | undefined) }
    const changedFields = Object.keys(settings).filter((key) => JSON.stringify(settings[key as keyof StoreSettingsValues]) !== JSON.stringify(previousValues[key as keyof StoreSettingsValues]))
    await db.transaction(async (tx) => {
      await tx.insert(storeSettings).values({ id: 'default', values: settings, updatedBy: session.user.id }).onConflictDoUpdate({ target: storeSettings.id, set: { values: settings, updatedBy: session.user.id, updatedAt: new Date() } })
      if (changedFields.length) await tx.insert(adminActivityLogs).values(activityValues(session, {
        actionType: 'settings.updated', entityType: 'store_settings', entityId: 'default', entityName: settings.storeName,
        description: `Updated store settings: ${changedFields.join(', ')}.`, metadata: { changedFields },
      }))
    })
    const [persisted] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1)
    const reloaded = { ...DEFAULT_STORE_SETTINGS, ...(persisted?.values as Partial<StoreSettingsValues> | undefined) }
    return NextResponse.json({ data: { settings: reloaded, configuration: publicConfigurationStatus(reloaded), changedFields } })
  } catch (error) {
    console.error('Settings update failed', error)
    return NextResponse.json({ error: { code: 'SETTINGS_UPDATE_FAILED', message: error instanceof Error && /required|invalid|between|Currency|valid web address|email|URL|social|location/i.test(error.message) ? error.message : 'Settings could not be saved.' } }, { status: 400 })
  }
}
