import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { getAdminSession } from '@/lib/auth/require-admin'
import { KnowledgeValidationError, validateKnowledgeInput } from '@/lib/knowledge/admin'

const columns = 'id, intent, title, category, content, approved_answer AS "approvedAnswer", keywords, source_document AS "sourceDocument", source_version AS "sourceVersion", approval_status AS "approvalStatus", enabled, approved_by AS "approvedBy", approved_at AS "approvedAt", updated_at AS "updatedAt"'
const failure = (message: string, status: number) => NextResponse.json({ error: { message } }, { status })
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Context) {
  if (!(await getAdminSession())) return failure('Admin access is required.', 401)
  const { id } = await context.params
  const result = await pool.query(`SELECT ${columns} FROM knowledge_entries WHERE id = $1`, [id])
  return result.rows[0] ? NextResponse.json({ data: { entry: result.rows[0] } }) : failure('Knowledge entry not found.', 404)
}

export async function PATCH(request: NextRequest, context: Context) {
  const session = await getAdminSession()
  if (!session) return failure('Admin access is required.', 401)
  const { id } = await context.params
  try {
    const input = validateKnowledgeInput(await request.json(), true)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query('SELECT approval_status, enabled FROM knowledge_entries WHERE id = $1 FOR UPDATE', [id])
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return failure('Knowledge entry not found.', 404) }
      const status = input.approvalStatus ?? existing.rows[0].approval_status
      const enabled = input.enabled ?? existing.rows[0].enabled
      if (enabled && status !== 'approved' && input.enabled === true) { await client.query('ROLLBACK'); return failure('Only approved entries can be enabled.', 400) }
      const fields: string[] = []
      const values: unknown[] = []
      const mapping = { intent: 'intent', title: 'title', category: 'category', content: 'content', approvedAnswer: 'approved_answer', keywords: 'keywords', sourceDocument: 'source_document', sourceVersion: 'source_version', approvalStatus: 'approval_status', enabled: 'enabled' } as const
      for (const [key, column] of Object.entries(mapping)) if (key in input) { values.push(input[key as keyof typeof mapping]); fields.push(`${column} = $${values.length}`) }
      if (input.approvalStatus && input.approvalStatus !== existing.rows[0].approval_status) {
        if (status === 'approved') { values.push(session.user.id, new Date()); fields.push(`approved_by = $${values.length - 1}`, `approved_at = $${values.length}`) }
        else fields.push('approved_by = NULL', 'approved_at = NULL')
      }
      if (status !== 'approved') fields.push('enabled = false')
      fields.push('updated_at = now()')
      values.push(id)
      const result = await client.query(`UPDATE knowledge_entries SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING ${columns}`, values)
      await client.query('COMMIT')
      return NextResponse.json({ data: { entry: result.rows[0] } })
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  } catch (error) {
    if (error instanceof KnowledgeValidationError || error instanceof SyntaxError) return failure(error.message, 400)
    console.error('Knowledge update failed', error); return failure('Knowledge entry could not be updated.', 500)
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  if (!(await getAdminSession())) return failure('Admin access is required.', 401)
  const { id } = await context.params
  try {
    const result = await pool.query('DELETE FROM knowledge_entries WHERE id = $1 RETURNING id', [id])
    return result.rowCount ? NextResponse.json({ data: { id } }) : failure('Knowledge entry not found.', 404)
  } catch (error) { console.error('Knowledge deletion failed', error); return failure('Knowledge entry could not be deleted.', 500) }
}
