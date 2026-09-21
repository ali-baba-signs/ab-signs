import { SupportError } from './validation'

export function boundedSupportBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new SupportError('Support request is too large.', 413)
  let received = 0
  const limited = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (received > maxBytes) throw new SupportError('Support request is too large.', 413)
      controller.enqueue(chunk)
    },
  }))
  return new Response(limited, { headers: { 'content-type': request.headers.get('content-type') || 'application/json' } })
}
