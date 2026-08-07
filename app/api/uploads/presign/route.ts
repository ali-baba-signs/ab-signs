import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/middleware'
import { adminAuth } from '@/lib/auth/admin-auth.config'
import { getUserRole } from '@/lib/auth/roles'
import { createPresignedUploadUrl, R2ConfigurationError } from '@/lib/storage/r2'
import { ADMIN_UPLOAD_PURPOSES, type UploadPurpose } from '@/lib/storage/r2-paths'
import {
  createUploadKey,
  UploadValidationError,
  validateUpload,
  type UploadRequest,
} from '@/lib/storage/upload-validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as UploadRequest
    validateUpload(body)

    const userSession = await getSession()
    const adminSession = await adminAuth.api.getSession({ headers: await headers() })
    const purpose = body.purpose as UploadPurpose
    const requiresAdmin = ADMIN_UPLOAD_PURPOSES.has(purpose)

    if (requiresAdmin && (!adminSession?.user || getUserRole(adminSession.user) !== 'admin')) {
      return NextResponse.json({ error: { code: 'UPLOAD_NOT_AUTHORIZED', message: 'Admin access is required.' } }, { status: 403 })
    }
    if (!requiresAdmin && !userSession?.user) {
      return NextResponse.json({ error: { code: 'UPLOAD_NOT_AUTHORIZED', message: 'Sign in to save uploaded artwork.' } }, { status: 401 })
    }

    const identity = adminSession?.user.id ?? userSession!.user.id
    const key = createUploadKey(body, identity)
    const uploadUrl = await createPresignedUploadUrl({ key, contentType: body.contentType })
    return NextResponse.json({ data: { uploadUrl, key, expiresIn: 300 } })
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 })
    }
    if (error instanceof R2ConfigurationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 503 })
    }
    return NextResponse.json({ error: { code: 'UPLOAD_FAILED', message: 'The upload could not be prepared.' } }, { status: 500 })
  }
}
