import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    { status }
  )
}

export function errorResponse(error: string | Error, status: number = 400) {
  const message = error instanceof Error ? error.message : error
  return NextResponse.json<ApiResponse<null>>(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

export function createdResponse<T>(data: T) {
  return successResponse(data, 201)
}

export function notFoundResponse(resource: string = 'Resource') {
  return errorResponse(`${resource} not found`, 404)
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401)
}

export function forbiddenResponse() {
  return errorResponse('Forbidden', 403)
}
