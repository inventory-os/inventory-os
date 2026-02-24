const SQL_LEAK_PATTERN =
  /\b(select|insert|update|delete|from|where|join|alter|create\s+table|drop\s+table|sqlite|postgres|sql|constraint|syntax\s+error)\b/i

export function toPublicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message?.trim()
  if (!message) {
    return fallback
  }

  if (message.length > 240 || message.includes("\n") || SQL_LEAK_PATTERN.test(message)) {
    return fallback
  }

  return message
}
