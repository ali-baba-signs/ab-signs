import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth/require-admin'
import { adminPath } from '@/lib/auth/admin-path'
import KnowledgeManager from './knowledge-manager'

export default async function KnowledgePage() {
  if (!(await getAdminSession())) redirect(adminPath('/login'))
  return <KnowledgeManager />
}
