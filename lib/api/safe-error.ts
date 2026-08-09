export function safeErrorMessage(error: unknown, fallback: string, allowed: RegExp) {
  if (error instanceof Error && allowed.test(error.message) && !/failed query|select |insert |update |delete |params:/i.test(error.message)) return error.message
  return fallback
}
