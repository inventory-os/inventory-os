import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("settings api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("reports runtime health with a successful database check", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const health = await client.settings.healthStatus.query()

    expect(health.checks.database).toBe(true)
    expect(typeof health.checkedAt).toBe("string")
  })

  it("persists and reads back general and qr public settings", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()

    const generalBefore = await client.settings.general.query()
    const qrBefore = await client.settings.qrPublic.query()

    const nextAppName = `Inventory OS Acceptance ${unique}`
    const nextOwnerLabel = `Acceptance Owner ${unique}`

    await client.settings.saveGeneral.mutate({
      appName: nextAppName,
      organizationName: generalBefore.organizationName,
      locale: generalBefore.locale,
      currency: generalBefore.currency,
    })

    await client.settings.saveQrPublic.mutate({
      enabled: qrBefore.enabled,
      ownerLabel: nextOwnerLabel,
      publicMessage: qrBefore.publicMessage,
      showLoginButton: qrBefore.showLoginButton,
      loginButtonText: qrBefore.loginButtonText,
      selectedAddressId: qrBefore.selectedAddressId,
      logoUrl: qrBefore.logoUrl,
      contactPhone: qrBefore.contactPhone,
      contactEmail: qrBefore.contactEmail,
      websiteUrl: qrBefore.websiteUrl,
      extraLinks: qrBefore.extraLinks,
    })

    const generalAfter = await client.settings.general.query()
    const qrAfter = await client.settings.qrPublic.query()

    expect(generalAfter.appName).toBe(nextAppName)
    expect(qrAfter.ownerLabel).toBe(nextOwnerLabel)
  })
})
