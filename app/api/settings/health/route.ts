import os from "node:os"
import { NextRequest, NextResponse } from "next/server"
import { getDashboardStats, getEffectiveSecuritySettings } from "@/lib/core-repository"
import { queryFirst, sql } from "@/lib/db"
import { isTrustedDomain, isTrustedProxyChain } from "@/lib/security-utils"

export async function GET(request: NextRequest) {
  const [security, dashboardStats] = await Promise.all([
    getEffectiveSecuritySettings(),
    getDashboardStats(),
  ])

  const host = request.headers.get("host") ?? ""
  const forwardedFor = request.headers.get("x-forwarded-for")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  const protocol = request.nextUrl.protocol

  const domainTrusted = isTrustedDomain(host, security.trustedDomains)
  const proxyChainTrusted = isTrustedProxyChain(forwardedFor, security.trustedProxies)
  const proxyHeadersDetected = Boolean(forwardedFor || forwardedProto || forwardedHost)
  const tlsFromForwarded = (forwardedProto ?? "").toLowerCase().includes("https")
  const tlsFromUrl = protocol === "https:"
  const tlsOk = tlsFromForwarded || tlsFromUrl

  const dbProbe = await queryFirst<{ ok: number }>(sql`SELECT 1 AS ok`)
  const databaseOk = Number(dbProbe?.ok ?? 0) === 1

  const totalMemoryBytes = os.totalmem()
  const freeMemoryBytes = os.freemem()
  const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes
  const memoryUsagePercent = totalMemoryBytes > 0 ? Math.round((usedMemoryBytes / totalMemoryBytes) * 1000) / 10 : 0
  const memoryOk = memoryUsagePercent < 90
  const proxyOk = domainTrusted && proxyChainTrusted
  const overallOk = proxyOk && tlsOk && databaseOk && memoryOk

  const issues: Array<{ id: string; title: string; severity: "warning" | "critical"; details: string; fix: string }> = []

  if (!domainTrusted) {
    issues.push({
      id: "untrusted-domain",
      title: "Domain not trusted",
      severity: "critical",
      details: `Host \"${host || "unknown"}\" is not in trusted domains (${security.trustedDomainsSource}).`,
      fix: security.trustedDomainsSource === "env"
        ? "Update TRUSTED_DOMAINS or INVENTORY_OS_TRUSTED_DOMAINS environment variable and restart the server."
        : "Go to Health → Security and add the current host to Trusted Domains.",
    })
  }

  if (!proxyChainTrusted) {
    issues.push({
      id: "untrusted-proxy",
      title: "Proxy chain not trusted",
      severity: "critical",
      details: "The nearest proxy in x-forwarded-for is not in trusted proxies.",
      fix: security.trustedProxiesSource === "env"
        ? "Update TRUSTED_PROXIES or INVENTORY_OS_TRUSTED_PROXIES environment variable and restart the server."
        : "Go to Health → Security and add your reverse proxy IP to Trusted Proxies.",
    })
  }

  if (!tlsOk) {
    issues.push({
      id: "tls-not-detected",
      title: "TLS not detected",
      severity: "critical",
      details: "Request is not seen as HTTPS and x-forwarded-proto is not https.",
      fix: "Terminate TLS at your reverse proxy and forward x-forwarded-proto=https to the app.",
    })
  }

  if (!databaseOk) {
    issues.push({
      id: "database-unhealthy",
      title: "Database check failed",
      severity: "critical",
      details: "The health probe could not run SELECT 1 successfully.",
      fix: "Check database connectivity, credentials, and file permissions for your configured DB backend.",
    })
  }

  if (!memoryOk) {
    issues.push({
      id: "memory-high",
      title: "Memory usage is high",
      severity: "warning",
      details: `Current memory usage is ${memoryUsagePercent}%.`,
      fix: "Increase memory limit, reduce concurrent load, or restart the service after checking for memory leaks.",
    })
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    overallOk,
    checks: {
      proxy: proxyOk,
      tls: tlsOk,
      database: databaseOk,
      memory: memoryOk,
    },
    issues,
    proxy: {
      ok: proxyOk,
      proxyHeadersDetected,
      host,
      forwardedFor: forwardedFor ?? null,
      forwardedProto: forwardedProto ?? null,
      forwardedHost: forwardedHost ?? null,
      domainTrusted,
      proxyChainTrusted,
      trustedDomainsConfigured: security.trustedDomains.length,
      trustedProxiesConfigured: security.trustedProxies.length,
      trustedDomainsSource: security.trustedDomainsSource,
      trustedProxiesSource: security.trustedProxiesSource,
    },
    tls: {
      ok: tlsOk,
      protocol,
      forwardedProto: forwardedProto ?? null,
      secureDetectedFromRequestUrl: tlsFromUrl,
      secureDetectedFromForwardedProto: tlsFromForwarded,
    },
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      memory: {
        usedBytes: usedMemoryBytes,
        totalBytes: totalMemoryBytes,
        usagePercent: memoryUsagePercent,
      },
    },
    stats: {
      totalAssets: dashboardStats.totalAssets,
      activeUsers: dashboardStats.activeUsers,
      locations: dashboardStats.locations,
      maintenance: dashboardStats.maintenance,
      inventoryValue: dashboardStats.inventoryValue,
    },
  })
}
