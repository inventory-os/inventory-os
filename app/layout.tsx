import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { Inter, JetBrains_Mono } from "next/font/google"
import { AppProviders } from "@/components/providers"
import { getEffectiveSecuritySettings } from "@/lib/services"
import { isTrustedDomain, isTrustedProxyChain } from "@/lib/utils/security-utils"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  title: "Inventory OS - Asset Tracking",
  description: "Modern asset tracking and management platform for teams",
}

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const requestHeaders = await headers()
  const host = requestHeaders.get("host") ?? ""
  const forwardedFor = requestHeaders.get("x-forwarded-for")

  const security = await getEffectiveSecuritySettings()
  const domainTrusted = isTrustedDomain(host, security.trustedDomains)
  const proxyTrusted = isTrustedProxyChain(forwardedFor, security.trustedProxies)
  const trustOk = domainTrusted && proxyTrusted

  const trustErrorTitle = !domainTrusted
    ? "Trusted domain configuration is invalid"
    : "Trusted proxy configuration is invalid"
  const trustErrorDetails = !domainTrusted
    ? `Host "${host || "unknown"}" is not allowed by your trusted domain configuration.`
    : "The request proxy chain does not match your trusted proxy configuration."
  const trustErrorFix = !domainTrusted
    ? security.trustedDomainsSource === "env"
      ? "Update TRUSTED_DOMAINS (or INVENTORY_OS_TRUSTED_DOMAINS) in your environment and restart the server."
      : "Open Health in an admin session and update Trusted Domains, or provide TRUSTED_DOMAINS via environment variables."
    : security.trustedProxiesSource === "env"
      ? "Update TRUSTED_PROXIES (or INVENTORY_OS_TRUSTED_PROXIES) in your environment and restart the server."
      : "Open Health in an admin session and update Trusted Proxies, or provide TRUSTED_PROXIES via environment variables."

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {trustOk ? (
          <AppProviders>{children}</AppProviders>
        ) : (
          <main className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-2xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                Proxy Configuration Error
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{trustErrorTitle}</h1>
              <p className="mt-3 text-sm text-muted-foreground">{trustErrorDetails}</p>
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">How to fix</p>
                <p className="mt-1 text-xs text-muted-foreground">{trustErrorFix}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Effective sources — Domains: {security.trustedDomainsSource.toUpperCase()} · Proxies:{" "}
                  {security.trustedProxiesSource.toUpperCase()}
                </p>
              </div>
            </div>
          </main>
        )}
      </body>
    </html>
  )
}
