function normalizeAppDomain(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "http://localhost:3000"
  }

  try {
    return new URL(trimmed).origin
  } catch {
    return "http://localhost:3000"
  }
}

function toAbsolute(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  const base = normalizeAppDomain(process.env.APP_DOMAIN)
  return new URL(normalizedPath, base).toString()
}

export function buildAssetQrPayload(assetId: string): string {
  return toAbsolute(`/qr/${assetId}`)
}

export function buildLocationQrPayload(locationId: string): string {
  return toAbsolute(`/qr/${locationId}`)
}
