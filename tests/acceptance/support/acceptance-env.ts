import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import net from "node:net"
import { writeFileSync } from "node:fs"
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers"

type Runtime = {
  postgres: StartedTestContainer
  oidc: StartedTestContainer
  appProcess: ChildProcessWithoutNullStreams
  baseUrl: string
}

let runtime: Runtime | null = null

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve free port"))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function waitForOk(url: string, timeoutMs: number, appProcess?: ChildProcessWithoutNullStreams, logs?: string[]): Promise<void> {
  const startedAt = Date.now()
  let lastStatus: number | null = null
  let lastBody: string | null = null
  while (Date.now() - startedAt < timeoutMs) {
    if (appProcess && appProcess.exitCode !== null) {
      throw new Error(`App process exited early with code ${appProcess.exitCode}.\n${(logs ?? []).join("\n")}`)
    }

    try {
      const response = await fetch(url)
      lastStatus = response.status
      if (!response.ok) {
        lastBody = await response.text()
      }
      if (response.ok) {
        return
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const diagnosticsPath = `${process.cwd()}/.acceptance-startup.log`
  writeFileSync(
    diagnosticsPath,
    [
      `URL: ${url}`,
      `Last status: ${String(lastStatus)}`,
      `Last body: ${lastBody ?? "<none>"}`,
      "--- APP LOGS ---",
      ...(logs ?? []),
    ].join("\n"),
    "utf8",
  )

  throw new Error(
    `Timed out waiting for ${url}. Last status=${String(lastStatus)} body=${lastBody ?? "<none>"}. Diagnostics: ${diagnosticsPath}`,
  )
}

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env ${name}`)
  }
  return value
}

export async function setupAcceptanceEnvironment(): Promise<void> {
  if (runtime) {
    return
  }

  process.env.AUTH_SESSION_SECRET = "acceptance-session-secret-which-is-long-enough-1234"

  const postgres = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "inventory_os_test",
      POSTGRES_USER: "inventory_os",
      POSTGRES_PASSWORD: "inventory_os",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
    .start()

  const appPort = await getFreePort()
  const appBaseUrl = `http://127.0.0.1:${appPort}`

  const oidc = await new GenericContainer("ghcr.io/navikt/mock-oauth2-server:3.0.1")
    .withEnvironment({
      SERVER_PORT: "8080",
      LOG_LEVEL: "INFO",
      JSON_CONFIG: JSON.stringify({
        interactiveLogin: false,
        tokenCallbacks: [
          {
            issuerId: "default",
            requestMappings: [
              {
                requestParam: "code",
                match: "acceptance-code",
                claims: {
                  sub: "oidc-user-1",
                  email: "acceptance.user@example.com",
                  name: "Acceptance User",
                  roles: ["admin"],
                },
              },
            ],
          },
        ],
      }),
    })
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp("/isalive", 8080))
    .start()

  const pgHost = postgres.getHost()
  const pgPort = postgres.getMappedPort(5432)
  const oidcHost = oidc.getHost()
  const oidcPort = oidc.getMappedPort(8080)
  if (!oidcPort || oidcPort <= 0) {
    throw new Error(`OIDC container did not expose a valid mapped port (got ${String(oidcPort)})`)
  }

  const databaseUrl = `postgresql://inventory_os:inventory_os@${pgHost}:${pgPort}/inventory_os_test`
  const oidcIssuer = `http://${oidcHost}:${oidcPort}/default`

  const appEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    AUTH_SESSION_SECRET: "acceptance-session-secret-which-is-long-enough-1234",
    DB_CLIENT: "pg",
    DATABASE_URL: databaseUrl,
    TRUSTED_DOMAINS: "localhost,127.0.0.1",
    OIDC_ISSUER_URL: oidcIssuer,
    OIDC_CLIENT_ID: "acceptance-client",
    OIDC_CLIENT_SECRET: "acceptance-secret",
    OIDC_REDIRECT_URI: `${appBaseUrl}/api/auth/callback`,
    OIDC_SCOPE: "openid profile email",
    OIDC_JIT_CREATE: "true",
    OIDC_ROLE_CLAIM: "roles",
    OIDC_ADMIN_ROLE_VALUE: "admin",
    OIDC_MEMBER_ROLE_VALUE: "member",
  }

  execFileSync(process.execPath, ["./node_modules/next/dist/bin/next", "build"], {
    cwd: process.cwd(),
    env: appEnv,
    stdio: "pipe",
  })

  const appProcess = spawn(
    process.execPath,
    ["./node_modules/next/dist/bin/next", "start", "-p", String(appPort), "-H", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: appEnv,
      stdio: "pipe",
    },
  ) as ChildProcessWithoutNullStreams

  const appLogs: string[] = []
  appProcess.stdout.on("data", (chunk: Buffer) => {
    appLogs.push(String(chunk))
    if (appLogs.length > 100) {
      appLogs.shift()
    }
  })
  appProcess.stderr.on("data", (chunk: Buffer) => {
    appLogs.push(String(chunk))
    if (appLogs.length > 100) {
      appLogs.shift()
    }
  })

  await waitForOk(`${appBaseUrl}/api/setup/status`, 120_000, appProcess, appLogs)

  process.env.ACCEPTANCE_BASE_URL = appBaseUrl
  process.env.ACCEPTANCE_OIDC_ISSUER = oidcIssuer

  runtime = {
    postgres,
    oidc,
    appProcess,
    baseUrl: appBaseUrl,
  }
}

export function getAcceptanceBaseUrl(): string {
  return process.env.ACCEPTANCE_BASE_URL ?? getEnv("ACCEPTANCE_BASE_URL")
}

export async function teardownAcceptanceEnvironment(): Promise<void> {
  if (!runtime) {
    return
  }

  runtime.appProcess.kill("SIGTERM")

  await runtime.oidc.stop()
  await runtime.postgres.stop()

  runtime = null
}
