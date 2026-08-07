import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { storeSettings } from '@/lib/db/schema'
import { DEFAULT_STORE_SETTINGS, type StoreSettingsValues } from '@/lib/store/settings'

export async function loadStoreSettings() {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1)
  return { ...DEFAULT_STORE_SETTINGS, ...(row?.values as Partial<StoreSettingsValues> | undefined) }
}
