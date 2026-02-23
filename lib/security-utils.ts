export function normalizeTrustEntries(values: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    const entry = value.trim().toLowerCase()
    if (!entry || seen.has(entry)) {
      continue
    }
    seen.add(entry)
    normalized.push(entry)
    if (normalized.length >= 100) {
      break
    }
  }

  return normalized
}

export function parseTrustEnvValue(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return normalizeTrustEntries(
    value
      .split(/[\n,;]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "")
}

export function isTrustedDomain(host: string, trustedDomains: string[]): boolean {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) {
    return false
  }

  if (trustedDomains.length === 0) {
    return true
  }

  return trustedDomains.some((entry) => {
    const domain = normalizeHost(entry)
    if (!domain) {
      return false
    }
    if (domain.startsWith("*.")) {
      const suffix = domain.slice(1)
      return normalizedHost.endsWith(suffix)
    }
    return normalizedHost === domain
  })
}

export function parseForwardedFor(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function isTrustedProxyChain(forwardedFor: string | null, trustedProxies: string[]): boolean {
  if (trustedProxies.length === 0) {
    return true
  }

  const hops = parseForwardedFor(forwardedFor)
  if (hops.length < 2) {
    return false
  }

  const nearestProxy = hops[hops.length - 1]?.toLowerCase() ?? ""
  return trustedProxies.some((entry) => entry.toLowerCase() === nearestProxy)
}
