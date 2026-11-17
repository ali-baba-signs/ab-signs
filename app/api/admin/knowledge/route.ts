import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { pool } from '@/lib/db/client'
import { getAdminSession } from '@/lib/auth/require-admin'
import { KnowledgeValidationError, validateKnowledgeInput } from '@/lib/knowledge/admin'

const columns = 'id, intent, title, category, content, approved_answer AS "approvedAnswer", keywords, source_document AS "sourceDocument", source_version AS "sourceVersion", approval_status AS "approvalStatus", enabled, approved_by AS "approvedBy", approved_at AS "approvedAt", updated_at AS "updatedAt"'
const failure = (message: string, status: number) => NextResponse.json({ error: { message } }, { status })

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return failure('Admin access is required.', 401)
  try {
    const params = request.nextUrl.searchParams
    const page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page') || '1', 10) || 1))
    const pageSize = 20
    const values: unknown[] = []
    const conditions: string[] = []
    const search = (params.get('search') || '').trim().slice(0, 200)
    if (search) { values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`); conditions.push(`(title ILIKE $${values.length} ESCAPE '\\' OR intent ILIKE $${values.length} ESCAPE '\\' OR content ILIKE $${values.length} ESCAPE '\\' OR array_to_string(keywords, ' ') ILIKE $${values.length} ESCAPE '\\')`) }
    const category = params.get('category') || ''
    if (category) { values.push(category); conditions.push(`category = $${values.length}`) }
    const status = params.get('status') || ''
    if (status && !['pending', 'approved', 'rejected'].includes(status)) return failure('Invalid approval filter.', 400)
    if (status) { values.push(status); conditions.push(`approval_status = $${values.length}`) }
    const enabled = params.get('enabled') || ''
    if (enabled && !['true', 'false'].includes(enabled)) return failure('Invalid enabled filter.', 400)
    if (enabled) { values.push(enabled === 'true'); conditions.push(`enabled = $${values.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const order = params.get('sort') === 'oldest' ? 'ASC' : 'DESC'
    const [count, rows, categories] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total FROM knowledge_entries ${where}`, values),
      pool.query(`SELECT ${columns} FROM knowledge_entries ${where} ORDER BY updated_at ${order}, id ${order} LIMIT ${pageSize} OFFSET $${values.length + 1}`, [...values, (page - 1) * pageSize]),
      pool.query(`SELECT DISTINCT category FROM knowledge_entries WHERE category IS NOT NULL AND category <> '' ORDER BY category`),
    ])
    return NextResponse.json({ data: { entries: rows.rows, total: count.rows[0].total, page, pageSize, categories: categories.rows.map((row) => row.category) } }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) { console.error('Knowledge listing failed', error); return failure('Knowledge entries could not be loaded.', 500) }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return failure('Admin access is required.', 401)
  try {
    const input = validateKnowledgeInput(await request.json())
    const status = input.approvalStatus!
    const result = await pool.query(`INSERT INTO knowledge_entries (id, intent, title, category, content, approved_answer, keywords, source_document, source_version, approval_status, enabled, approved_by, approved_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()) RETURNING ${columns}`,
      [randomUUID(), input.intent, input.title, input.category, input.content, input.approvedAnswer, input.keywords, input.sourceDocument, input.sourceVersion, status, status === 'approved' && input.enabled, status === 'approved' ? session.user.id : null, status === 'approved' ? new Date() : null])
    return NextResponse.json({ data: { entry: result.rows[0] } }, { status: 201 })
  } catch (error) {
    if (error instanceof KnowledgeValidationError || error instanceof SyntaxError) return failure(error.message, 400)
    console.error('Knowledge creation failed', error); return failure('Knowledge entry could not be created.', 500)
  }
}
