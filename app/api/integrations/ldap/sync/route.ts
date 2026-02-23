import { NextResponse } from "next/server"
import { getLdapIntegrationBindPassword, getLdapIntegrationSettings, notifyLdapSyncFailed, upsertAuthUserFromLdap, upsertMemberByEmail } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"
import { fetchLdapUsers } from "@/lib/ldap-sync"

function toTeamRole(value: string): "admin" | "member" {
  if (value === "admin" || value === "member") {
    return value
  }
  return "member"
}

export async function POST() {
  const settings = await getLdapIntegrationSettings()

  if (!settings.enabled) {
    await notifyLdapSyncFailed("LDAP integration is disabled")
    return NextResponse.json({ error: "LDAP integration is disabled" }, { status: 400 })
  }

  if (!settings.url || !settings.bindDn || !settings.baseDn || !settings.syncIssuer) {
    await notifyLdapSyncFailed("LDAP integration is not fully configured")
    return NextResponse.json({ error: "LDAP integration is not fully configured" }, { status: 400 })
  }

  const bindPassword = await getLdapIntegrationBindPassword()
  if (!bindPassword) {
    await notifyLdapSyncFailed("LDAP bind password is missing")
    return NextResponse.json({ error: "LDAP bind password is missing" }, { status: 400 })
  }

  try {
    const users = await fetchLdapUsers({
      url: settings.url,
      bindDn: settings.bindDn,
      bindPassword,
      baseDn: settings.baseDn,
      userFilter: settings.userFilter,
      usernameAttribute: settings.usernameAttribute,
      emailAttribute: settings.emailAttribute,
      nameAttribute: settings.nameAttribute,
    })

    let synced = 0
    for (const user of users) {
      await upsertAuthUserFromLdap({
        issuer: settings.syncIssuer,
        sub: user.sub,
        email: user.email,
        displayName: user.displayName,
        role: settings.defaultRole,
        active: true,
      })
      await upsertMemberByEmail({
        name: user.displayName,
        email: user.email,
        role: toTeamRole(settings.defaultRole),
      })
      synced += 1
    }

    return NextResponse.json({ ok: true, synced, found: users.length })
  } catch (error) {
    const publicMessage = toPublicErrorMessage(error, "LDAP sync failed")
    await notifyLdapSyncFailed(publicMessage)
    return NextResponse.json({ error: publicMessage }, { status: 400 })
  }
}
