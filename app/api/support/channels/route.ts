import { NextRequest } from 'next/server'
import { handleSupportRequest } from '@/lib/support/http'
export const runtime='nodejs'
export async function POST(request:NextRequest){return handleSupportRequest(request,true)}
