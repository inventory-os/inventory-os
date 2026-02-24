import { Client } from "ldapts"

export type LdapSyncUser = {
  sub: string
  email: string
  displayName: string
}

export async function fetchLdapUsers(input: {
  url: string
  bindDn: string
  bindPassword: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
}): Promise<LdapSyncUser[]> {
  const client = new Client({ url: input.url })

  try {
    await client.bind(input.bindDn, input.bindPassword)

    const attributes = [input.usernameAttribute, input.emailAttribute, input.nameAttribute]
    const { searchEntries } = await client.search(input.baseDn, {
      scope: "sub",
      filter: input.userFilter,
      attributes,
      paged: true,
      sizeLimit: 0,
    })

    const users: LdapSyncUser[] = []

    for (const entry of searchEntries) {
      const username = readLdapString(entry[input.usernameAttribute])
      const email = readLdapString(entry[input.emailAttribute])
      const name = readLdapString(entry[input.nameAttribute])

      if (!username || !email) {
        continue
      }

      users.push({
        sub: username,
        email: email.toLowerCase(),
        displayName: name || username,
      })
    }

    return users
  } finally {
    await client.unbind().catch(() => undefined)
  }
}

function readLdapString(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        return entry.trim()
      }
    }
  }

  if (Buffer.isBuffer(value)) {
    const parsed = value.toString("utf8").trim()
    return parsed || null
  }

  return null
}
