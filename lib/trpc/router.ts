import { z } from "zod"
import os from "node:os"
import {
  AddressInputSchema,
  AssetFileRefInputSchema,
  AssetIdInputSchema,
  BindOrCreateAuthUserFromOidcInputSchema,
  BorrowAssetInputSchema,
  ChangedFieldsInputSchema,
  CompleteInitialSetupInputSchema,
  CreateAssetFileRecordInputSchema,
  CreateAssetInputSchema,
  CreateIncidentFileRecordInputSchema,
  CreateIncidentInputSchema,
  EmailInputSchema,
  IdInputSchema,
  IncidentFileRefInputSchema,
  IncidentIdInputSchema,
  ListActivityEventsInputSchema,
  ListIncidentsInputSchema,
  LocationInputSchema,
  MemberIdInputSchema,
  MemberInputSchema,
  MessageInputSchema,
  NameInputSchema,
  NotificationListInputSchema,
  NotificationMutationInputSchema,
  NotifyAssetBorrowedInputSchema,
  NotifyAssetReturnedInputSchema,
  NotifyAssetStatusChangedInputSchema,
  NotifyLowInventoryForAssetInputSchema,
  NotifyMemberRoleChangedInputSchema,
  ParentAssetIdInputSchema,
  ProducerInputSchema,
  RecordActivityEventInputSchema,
  SaveLdapIntegrationSettingsInputSchema,
  SaveNotificationPreferencesInputSchema,
  SaveQrPublicSettingsInputSchema,
  SaveSecuritySettingsInputSchema,
  SaveWorkspaceSettingsInputSchema,
  SourceAssetIdInputSchema,
  SubjectInputSchema,
  UpdateAssetInputSchema,
  UpdateAuthUserByIdInputSchema,
  UpdateIncidentInputSchema,
  UpsertAuthUserFromLdapInputSchema,
} from "@/lib/types"
import * as services from "@/lib/services"
import { createTrpcRouter, publicProcedure } from "@/lib/trpc/core"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"
import { verifySessionToken } from "@/lib/services/auth-session.service"
import { queryFirst, sql } from "@/lib/db"
import { isTrustedDomain, isTrustedProxyChain } from "@/lib/utils/security-utils"
import { fetchLdapUsers } from "@/lib/services/ldap-sync.service"
import { buildLocationQrPayload } from "@/lib/utils/qr-payload"

const updateAddressByIdInputSchema = z.object({
  id: z.string().min(1),
  input: AddressInputSchema,
})

const updateAssetByIdInputSchema = z.object({
  id: z.string().min(1),
  input: UpdateAssetInputSchema,
})

const updateCategoryByIdInputSchema = z.object({
  id: z.string().min(1),
  name: NameInputSchema.shape.name,
})

const updateIncidentByIdInputSchema = z.object({
  id: z.string().min(1),
  input: UpdateIncidentInputSchema,
})

const updateLocationByIdInputSchema = z.object({
  id: z.string().min(1),
  input: LocationInputSchema,
})

const updateProducerByIdInputSchema = z.object({
  id: z.string().min(1),
  input: ProducerInputSchema,
})

const importProducerByUrlInputSchema = z.object({
  url: z.string().url(),
})

const updateAuthUserByIdInputSchema = z.object({
  id: z.string().min(1),
  input: UpdateAuthUserByIdInputSchema,
})

const runNotificationsInputSchema = z
  .object({
    referenceDate: z.string().datetime().optional(),
  })
  .optional()

const locationIdInputSchema = z.object({
  locationId: z.string().min(1),
})

const selfNotificationsListInputSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional(),
  })
  .optional()

const selfNotificationMutationInputSchema = z.object({
  id: z.string().min(1),
})

const searchInputSchema = z.object({
  query: z.string().trim().max(120),
})

const qrResolveInputSchema = z.object({
  id: z.string().trim().min(1),
})

const healthInputSchema = z.void()

const incidentListExtendedInputSchema = z
  .object({
    assetId: z.string().trim().optional(),
    status: z.enum(["open", "investigating", "resolved", "all"]).optional(),
    search: z.string().trim().optional(),
    severity: z.enum(["low", "medium", "high", "critical", "all"]).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
  })
  .optional()

const locationDetailsInputSchema = z.object({
  id: z.string().trim().min(1),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  category: z.string().trim().optional(),
})

const runLdapSyncInputSchema = z.void()

function normalizeWebsiteUrl(input: string): string {
  const parsed = new URL(input)
  parsed.hash = ""
  parsed.search = ""
  parsed.pathname = "/"
  return parsed.toString().replace(/\/$/, "")
}

function extractMetaTag(html: string, key: string, by: "name" | "property") {
  const pattern = new RegExp(`<meta[^>]*${by}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i")
  return html.match(pattern)?.[1]?.trim() ?? null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match?.[1]?.trim() ?? null
}

function toProducerName(hostname: string): string {
  const base = hostname.replace(/^www\./i, "").split(".")[0] ?? hostname
  if (!base) {
    return hostname
  }
  return base.charAt(0).toUpperCase() + base.slice(1)
}

async function importProducerFromWebsite(inputUrl: string) {
  const normalized = normalizeWebsiteUrl(inputUrl)
  const websiteUrl = new URL(normalized)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(websiteUrl.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Inventory OsProducerImporter/1.0 (+https://inventory-os.local)",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Could not fetch website (${response.status})`)
    }

    const html = await response.text()
    const finalUrl = normalizeWebsiteUrl(response.url || websiteUrl.toString())
    const finalParsed = new URL(finalUrl)

    const title = extractTitle(html)
    const ogSiteName = extractMetaTag(html, "og:site_name", "property")
    const ogTitle = extractMetaTag(html, "og:title", "property")
    const description =
      extractMetaTag(html, "description", "name") ?? extractMetaTag(html, "og:description", "property") ?? null
    const ogImage = extractMetaTag(html, "og:image", "property")

    const name = ogSiteName ?? ogTitle ?? title ?? toProducerName(finalParsed.hostname)
    const logoUrl = ogImage
      ? new URL(ogImage, `${finalParsed.protocol}//${finalParsed.host}`).toString()
      : `${finalParsed.protocol}//${finalParsed.host}/favicon.ico`

    return {
      name,
      websiteUrl: finalUrl,
      domain: finalParsed.hostname.replace(/^www\./i, ""),
      description,
      logoUrl,
      sourceUrl: inputUrl,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveAuthedUser(ctx: { req: Request }) {
  const cookieHeader = ctx.req.headers.get("cookie") ?? ""
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=")
        if (separatorIndex < 0) {
          return [entry, ""] as const
        }
        return [entry.slice(0, separatorIndex), decodeURIComponent(entry.slice(separatorIndex + 1))] as const
      }),
  )

  const token = cookies.get(SESSION_COOKIE_NAME)
  const session = verifySessionToken(token)
  if (!session) {
    return null
  }

  const user = await services.findAuthUserById(session.uid)
  if (!user || !user.active) {
    return null
  }

  const memberId = await services.findMemberIdByEmail(user.email)

  return {
    id: user.id,
    memberId,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
  }
}

type QrEntity =
  | { type: "asset"; id: string; name: string; redirectTo: string }
  | { type: "location"; id: string; name: string; redirectTo: string }

async function resolveQrEntity(id: string): Promise<QrEntity | null> {
  const asset = await services.getAssetById(id)
  if (asset) {
    return { type: "asset", id: asset.id, name: asset.name, redirectTo: `/assets/${asset.id}` }
  }

  const location = await services.getLocationById(id)
  if (location) {
    return { type: "location", id: location.id, name: location.name, redirectTo: `/locations/${location.id}` }
  }

  return null
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim()
}

function matchesAllTerms(searchable: string, terms: string[]): boolean {
  const text = normalizeSearch(searchable)
  return terms.every((term) => text.includes(term))
}

function toTeamRole(value: string): "admin" | "member" {
  if (value === "admin" || value === "member") {
    return value
  }
  return "member"
}

export const appRouter = createTrpcRouter({
  addresses: createTrpcRouter({
    list: publicProcedure.query(() => services.listAddresses()),
    create: publicProcedure.input(AddressInputSchema).mutation(({ input }) => services.createAddress(input)),
    update: publicProcedure
      .input(updateAddressByIdInputSchema)
      .mutation(({ input }) => services.updateAddress(input.id, input.input)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteAddress(input.id)),
  }),

  assets: createTrpcRouter({
    list: publicProcedure.query(() => services.listAssets()),
    byId: publicProcedure.input(IdInputSchema).query(({ input }) => services.getAssetById(input.id)),
    create: publicProcedure.input(CreateAssetInputSchema).mutation(({ input }) => services.createAsset(input)),
    duplicate: publicProcedure
      .input(SourceAssetIdInputSchema)
      .mutation(({ input }) => services.duplicateAsset(input.sourceAssetId)),
    update: publicProcedure
      .input(updateAssetByIdInputSchema)
      .mutation(({ input }) => services.updateAsset(input.id, input.input)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteAsset(input.id)),
    listChildren: publicProcedure
      .input(ParentAssetIdInputSchema)
      .query(({ input }) => services.listAssetChildren(input.parentAssetId)),
    listTags: publicProcedure.query(() => services.listAssetTags()),
    listFiles: publicProcedure.input(AssetIdInputSchema).query(({ input }) => services.listAssetFiles(input.assetId)),
    createFileRecord: publicProcedure
      .input(CreateAssetFileRecordInputSchema)
      .mutation(({ input }) => services.createAssetFileRecord(input)),
    fileById: publicProcedure
      .input(AssetFileRefInputSchema)
      .query(({ input }) => services.getAssetFileById(input.assetId, input.fileId)),
    deleteFileRecord: publicProcedure
      .input(AssetFileRefInputSchema)
      .mutation(({ input }) => services.deleteAssetFileRecord(input.assetId, input.fileId)),
    listByLocationTree: publicProcedure
      .input(locationIdInputSchema)
      .query(({ input }) => services.listAssetsByLocationTree(input.locationId)),
    borrow: publicProcedure.input(BorrowAssetInputSchema).mutation(({ input }) => services.borrowAsset(input)),
    return: publicProcedure.input(AssetIdInputSchema).mutation(({ input }) => services.returnAsset(input.assetId)),
    openLoan: publicProcedure
      .input(AssetIdInputSchema)
      .query(({ input }) => services.getOpenLoanForAsset(input.assetId)),
    history: publicProcedure.input(AssetIdInputSchema).query(({ input }) => services.getAssetHistory(input.assetId)),
  }),

  auth: createTrpcRouter({
    listUsers: publicProcedure.query(() => services.listAuthUsers()),
    bySubject: publicProcedure
      .input(SubjectInputSchema)
      .query(({ input }) => services.findAuthUserBySubject(input.issuer, input.sub)),
    byEmail: publicProcedure.input(EmailInputSchema).query(({ input }) => services.findAuthUserByEmail(input.email)),
    byId: publicProcedure.input(IdInputSchema).query(({ input }) => services.findAuthUserById(input.id)),
    updateById: publicProcedure
      .input(updateAuthUserByIdInputSchema)
      .mutation(({ input }) => services.updateAuthUserById(input.id, input.input)),
    deactivateById: publicProcedure
      .input(IdInputSchema)
      .mutation(({ input }) => services.deactivateAuthUserById(input.id)),
    bindOrCreateFromOidc: publicProcedure
      .input(BindOrCreateAuthUserFromOidcInputSchema)
      .mutation(({ input }) => services.bindOrCreateAuthUserFromOidc(input)),
    upsertFromLdap: publicProcedure
      .input(UpsertAuthUserFromLdapInputSchema)
      .mutation(({ input }) => services.upsertAuthUserFromLdap(input)),
    me: publicProcedure.query(async ({ ctx }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user) {
        return { authenticated: false as const }
      }

      return {
        authenticated: true as const,
        user,
      }
    }),
  }),

  categories: createTrpcRouter({
    list: publicProcedure.query(() => services.listManagedCategories()),
    create: publicProcedure.input(NameInputSchema).mutation(({ input }) => services.createCategory(input.name)),
    update: publicProcedure
      .input(updateCategoryByIdInputSchema)
      .mutation(({ input }) => services.updateCategory(input.id, input.name)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteCategory(input.id)),
    summary: publicProcedure.query(() => services.getCategorySummary()),
  }),

  dashboard: createTrpcRouter({
    stats: publicProcedure.query(() => services.getDashboardStats()),
  }),

  incidents: createTrpcRouter({
    list: publicProcedure
      .input(ListIncidentsInputSchema.optional())
      .query(({ input }) => services.listIncidents(input)),
    listExtended: publicProcedure.input(incidentListExtendedInputSchema).query(async ({ input }) => {
      const page = Math.max(1, input?.page ?? 1)
      const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 10))
      const severity = input?.severity ?? "all"

      const incidents = await services.listIncidents({
        assetId: input?.assetId?.trim() || undefined,
        status: input?.status ?? "all",
        search: input?.search?.trim() || undefined,
      })

      const filtered = severity === "all" ? incidents : incidents.filter((incident) => incident.severity === severity)
      const total = filtered.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const normalizedPage = Math.min(page, totalPages)
      const start = (normalizedPage - 1) * pageSize
      const pagedIncidents = filtered.slice(start, start + pageSize)

      const counts = {
        open: filtered.filter((incident) => incident.status === "open").length,
        investigating: filtered.filter((incident) => incident.status === "investigating").length,
        resolved: filtered.filter((incident) => incident.status === "resolved").length,
        critical: filtered.filter((incident) => incident.severity === "critical").length,
      }

      return {
        incidents: pagedIncidents,
        counts,
        pagination: {
          page: normalizedPage,
          pageSize,
          total,
          totalPages,
        },
      }
    }),
    byId: publicProcedure.input(IdInputSchema).query(async ({ input }) => {
      const incident = (await services.listIncidents()).find((entry) => entry.id === input.id)
      return incident ?? null
    }),
    listByAsset: publicProcedure
      .input(AssetIdInputSchema)
      .query(({ input }) => services.listAssetIncidents(input.assetId)),
    create: publicProcedure.input(CreateIncidentInputSchema).mutation(({ input }) => services.createIncident(input)),
    update: publicProcedure
      .input(updateIncidentByIdInputSchema)
      .mutation(({ input }) => services.updateIncident(input.id, input.input)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteIncident(input.id)),
    listFiles: publicProcedure
      .input(IncidentIdInputSchema)
      .query(({ input }) => services.listIncidentFiles(input.incidentId)),
    createFileRecord: publicProcedure
      .input(CreateIncidentFileRecordInputSchema)
      .mutation(({ input }) => services.createIncidentFileRecord(input)),
    fileById: publicProcedure
      .input(IncidentFileRefInputSchema)
      .query(({ input }) => services.getIncidentFileById(input.incidentId, input.fileId)),
    deleteFileRecord: publicProcedure
      .input(IncidentFileRefInputSchema)
      .mutation(({ input }) => services.deleteIncidentFileRecord(input.incidentId, input.fileId)),
  }),

  integrations: createTrpcRouter({
    ldapSettings: publicProcedure.query(() => services.getLdapIntegrationSettings()),
    saveLdapSettings: publicProcedure
      .input(SaveLdapIntegrationSettingsInputSchema)
      .mutation(({ input }) => services.saveLdapIntegrationSettings(input)),
    ldapBindPassword: publicProcedure.query(() => services.getLdapIntegrationBindPassword()),
    runLdapSync: publicProcedure.input(runLdapSyncInputSchema).mutation(async () => {
      const settings = await services.getLdapIntegrationSettings()

      if (!settings.enabled) {
        await services.notifyLdapSyncFailed("LDAP integration is disabled")
        throw new Error("LDAP integration is disabled")
      }

      if (!settings.url || !settings.bindDn || !settings.baseDn || !settings.syncIssuer) {
        await services.notifyLdapSyncFailed("LDAP integration is not fully configured")
        throw new Error("LDAP integration is not fully configured")
      }

      const bindPassword = await services.getLdapIntegrationBindPassword()
      if (!bindPassword) {
        await services.notifyLdapSyncFailed("LDAP bind password is missing")
        throw new Error("LDAP bind password is missing")
      }

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
        await services.upsertAuthUserFromLdap({
          issuer: settings.syncIssuer,
          sub: user.sub,
          email: user.email,
          displayName: user.displayName,
          role: settings.defaultRole,
          active: true,
        })
        await services.upsertMemberByEmail({
          name: user.displayName,
          email: user.email,
          role: toTeamRole(settings.defaultRole),
        })
        synced += 1
      }

      return { ok: true, synced, found: users.length }
    }),
  }),

  activity: createTrpcRouter({
    record: publicProcedure
      .input(RecordActivityEventInputSchema)
      .mutation(({ input }) => services.recordActivityEvent(input)),
    list: publicProcedure.input(ListActivityEventsInputSchema).query(({ input }) => services.listActivityEvents(input)),
  }),

  locations: createTrpcRouter({
    list: publicProcedure.query(() => services.listLocations()),
    byId: publicProcedure.input(IdInputSchema).query(({ input }) => services.getLocationById(input.id)),
    details: publicProcedure.input(locationDetailsInputSchema).query(async ({ input }) => {
      const page = Math.max(Number(input.page ?? "1") || 1, 1)
      const pageSize = Math.min(Math.max(Number(input.page ?? "10") || 10, 1), 100)
      const search = (input.search ?? "").trim().toLowerCase()
      const status = (input.status ?? "all").trim().toLowerCase()
      const category = (input.category ?? "all").trim().toLowerCase()

      const [location, allLocations, allAssets] = await Promise.all([
        services.getLocationById(input.id),
        services.listLocations(),
        services.listAssetsByLocationTree(input.id),
      ])

      if (!location) {
        return null
      }

      const parent = location.parentId ? (allLocations.find((entry) => entry.id === location.parentId) ?? null) : null
      const children = allLocations.filter((entry) => entry.parentId === location.id)
      const assetCategories = Array.from(new Set(allAssets.map((asset) => asset.category))).sort((left, right) =>
        left.localeCompare(right),
      )

      const searchTerms = search
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)

      const filteredAssets = allAssets.filter((asset) => {
        const searchable = [asset.id, asset.name, asset.location, asset.category, asset.status, asset.assignedTo ?? ""]
          .join(" ")
          .toLowerCase()

        const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term))
        const matchesStatus = status === "all" || asset.status.toLowerCase() === status
        const matchesCategory = category === "all" || asset.category.toLowerCase() === category

        return matchesSearch && matchesStatus && matchesCategory
      })

      const total = filteredAssets.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(page, totalPages)
      const start = (safePage - 1) * pageSize
      const assets = filteredAssets.slice(start, start + pageSize)

      return {
        location,
        parent,
        children,
        assets,
        assetCategories,
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages,
        },
        qrPayload: buildLocationQrPayload(location.id),
      }
    }),
    create: publicProcedure.input(LocationInputSchema).mutation(({ input }) => services.createLocation(input)),
    update: publicProcedure
      .input(updateLocationByIdInputSchema)
      .mutation(({ input }) => services.updateLocation(input.id, input.input)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteLocation(input.id)),
  }),

  loans: createTrpcRouter({
    list: publicProcedure.query(() => services.listLoans()),
  }),

  members: createTrpcRouter({
    list: publicProcedure.query(() => services.listMembers()),
    findIdByEmail: publicProcedure
      .input(EmailInputSchema)
      .query(({ input }) => services.findMemberIdByEmail(input.email)),
    create: publicProcedure.input(MemberInputSchema).mutation(({ input }) => services.createMember(input)),
    profile: publicProcedure.input(MemberIdInputSchema).query(({ input }) => services.getMemberProfile(input.memberId)),
    profileById: publicProcedure.input(IdInputSchema).query(({ input }) => services.getMemberProfile(input.id)),
    upsertByEmail: publicProcedure
      .input(MemberInputSchema)
      .mutation(({ input }) => services.upsertMemberByEmail(input)),
  }),

  qr: createTrpcRouter({
    resolve: publicProcedure.input(qrResolveInputSchema).query(async ({ ctx, input }) => {
      const [entity, qrSettings, setup, addresses] = await Promise.all([
        resolveQrEntity(input.id),
        services.getQrPublicSettings(),
        services.getSetupStatus(),
        services.listAddresses(),
      ])

      if (!entity) {
        return { found: false as const }
      }

      const user = await resolveAuthedUser(ctx)
      const authenticated = Boolean(user)

      await services.recordActivityEvent({
        type: "qr.scan",
        actorMemberId: user?.memberId ?? null,
        actorName: user?.displayName ?? "Public user",
        subjectType: entity.type,
        subjectId: entity.id,
        subjectName: entity.name,
        message: `${user?.displayName ?? "Public user"} scanned ${entity.type} ${entity.name}.`,
      })

      if (authenticated) {
        return {
          found: true as const,
          authenticated: true as const,
          redirectTo: entity.redirectTo,
          entity: {
            type: entity.type,
            id: entity.id,
            name: entity.name,
          },
        }
      }

      if (!qrSettings.enabled) {
        return { found: false as const }
      }

      const selectedAddress = qrSettings.selectedAddressId
        ? (addresses.find((entry) => entry.id === qrSettings.selectedAddressId) ?? null)
        : null

      return {
        found: true as const,
        authenticated: false as const,
        redirectTo: null,
        entity: {
          type: entity.type,
          id: entity.id,
          name: entity.name,
        },
        public: {
          ownerLabel: qrSettings.ownerLabel || setup.organizationName || setup.appName,
          message: qrSettings.publicMessage,
          showLoginButton: qrSettings.showLoginButton,
          loginButtonText: qrSettings.loginButtonText,
          logoUrl: qrSettings.logoUrl,
          contactPhone: qrSettings.contactPhone,
          contactEmail: qrSettings.contactEmail,
          websiteUrl: qrSettings.websiteUrl,
          extraLinks: qrSettings.extraLinks,
          selectedAddress: selectedAddress
            ? {
                id: selectedAddress.id,
                label: selectedAddress.label,
                fullAddress: selectedAddress.fullAddress,
              }
            : null,
          loginUrl: `/api/auth/login?returnTo=${encodeURIComponent(`/qr/${entity.id}`)}`,
        },
      }
    }),
  }),

  search: createTrpcRouter({
    query: publicProcedure.input(searchInputSchema).query(async ({ input }) => {
      const query = input.query.trim().slice(0, 120)
      const sectionLimit = 8

      if (!query) {
        return {
          query: "",
          assets: [],
          producers: [],
          members: [],
          locations: [],
          categories: [],
        }
      }

      const terms = normalizeSearch(query)
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)

      const [assets, producers, members, locations, categories] = await Promise.all([
        services.listAssets(),
        services.listProducers(),
        services.listMembers(),
        services.listLocations(),
        services.listManagedCategories(),
      ])

      const matchedAssets = assets.filter((asset) =>
        matchesAllTerms(
          [
            asset.id,
            asset.name,
            asset.category,
            asset.status,
            asset.location,
            asset.assignedTo ?? "",
            asset.producerName ?? "",
            asset.model ?? "",
            asset.serialNumber ?? "",
            asset.sku ?? "",
            ...asset.tags,
          ].join(" "),
          terms,
        ),
      )

      const matchedProducers = producers
        .filter((producer) =>
          matchesAllTerms(
            [
              producer.id,
              producer.name,
              producer.domain,
              producer.websiteUrl,
              producer.sourceUrl,
              producer.description ?? "",
            ].join(" "),
            terms,
          ),
        )
        .slice(0, sectionLimit)

      const matchedMembers = members
        .filter((member) => matchesAllTerms([member.id, member.name, member.email, member.role].join(" "), terms))
        .slice(0, sectionLimit)

      const matchedLocations = locations
        .filter((location) =>
          matchesAllTerms(
            [
              location.id,
              location.name,
              location.path,
              location.address,
              location.locationCode ?? "",
              location.kind,
            ].join(" "),
            terms,
          ),
        )
        .slice(0, sectionLimit)

      const matchedCategories = categories
        .filter((category) => matchesAllTerms([category.id, category.name].join(" "), terms))
        .slice(0, sectionLimit)

      const directAssetIds = new Set(matchedAssets.map((asset) => asset.id))
      const matchedMemberNames = new Set(matchedMembers.map((member) => normalizeSearch(member.name)))
      const matchedProducerNames = new Set(matchedProducers.map((producer) => normalizeSearch(producer.name)))
      const matchedLocationNames = matchedLocations.map((location) => normalizeSearch(location.name)).filter(Boolean)
      const matchedLocationPaths = matchedLocations.map((location) => normalizeSearch(location.path)).filter(Boolean)
      const matchedCategoryNames = matchedCategories.map((category) => normalizeSearch(category.name)).filter(Boolean)

      const relatedAssets: Array<{
        asset: (typeof assets)[number]
        matchType: "related-member" | "related-producer" | "related-location" | "related-category"
      }> = []

      for (const asset of assets) {
        if (directAssetIds.has(asset.id)) {
          continue
        }

        const assignedTo = normalizeSearch(asset.assignedTo ?? "")
        const producerName = normalizeSearch(asset.producerName ?? "")
        const location = normalizeSearch(asset.location)
        const category = normalizeSearch(asset.category)

        if (assignedTo && matchedMemberNames.has(assignedTo)) {
          relatedAssets.push({ asset, matchType: "related-member" })
          continue
        }

        if (producerName && matchedProducerNames.has(producerName)) {
          relatedAssets.push({ asset, matchType: "related-producer" })
          continue
        }

        const isLocationRelated =
          location &&
          (matchedLocationNames.some(
            (candidate) => candidate === location || candidate.includes(location) || location.includes(candidate),
          ) ||
            matchedLocationPaths.some((candidatePath) => candidatePath.includes(location)))

        if (isLocationRelated) {
          relatedAssets.push({ asset, matchType: "related-location" })
          continue
        }

        const isCategoryRelated =
          category &&
          matchedCategoryNames.some(
            (candidate) => candidate === category || candidate.includes(category) || category.includes(candidate),
          )

        if (isCategoryRelated) {
          relatedAssets.push({ asset, matchType: "related-category" })
        }
      }

      const assetResults = [
        ...matchedAssets.map((asset) => ({ asset, matchType: "direct" as const })),
        ...relatedAssets,
      ].slice(0, sectionLimit * 2)

      return {
        query,
        assets: assetResults,
        producers: matchedProducers,
        members: matchedMembers,
        locations: matchedLocations,
        categories: matchedCategories,
      }
    }),
  }),

  notifications: createTrpcRouter({
    listForMember: publicProcedure
      .input(NotificationListInputSchema)
      .query(({ input }) => services.listNotificationsForMember(input.memberId, input.limit)),
    markRead: publicProcedure
      .input(NotificationMutationInputSchema)
      .mutation(({ input }) => services.markNotificationRead(input.id, input.memberId)),
    markAllRead: publicProcedure
      .input(MemberIdInputSchema)
      .mutation(({ input }) => services.markAllNotificationsRead(input.memberId)),
    remove: publicProcedure
      .input(NotificationMutationInputSchema)
      .mutation(({ input }) => services.deleteNotification(input.id, input.memberId)),
    removeAll: publicProcedure
      .input(MemberIdInputSchema)
      .mutation(({ input }) => services.deleteAllNotifications(input.memberId)),
    notifyAssetBorrowed: publicProcedure
      .input(NotifyAssetBorrowedInputSchema)
      .mutation(({ input }) => services.notifyAssetBorrowed(input)),
    notifyAssetReturned: publicProcedure
      .input(NotifyAssetReturnedInputSchema)
      .mutation(({ input }) => services.notifyAssetReturned(input)),
    notifyAssetStatusChanged: publicProcedure
      .input(NotifyAssetStatusChangedInputSchema)
      .mutation(({ input }) => services.notifyAssetStatusChanged(input)),
    notifyLowInventory: publicProcedure
      .input(NotifyLowInventoryForAssetInputSchema)
      .mutation(({ input }) => services.notifyLowInventoryForAsset(input)),
    notifyMemberRoleChanged: publicProcedure
      .input(NotifyMemberRoleChangedInputSchema)
      .mutation(({ input }) => services.notifyMemberRoleChanged(input)),
    notifyLdapSyncFailed: publicProcedure
      .input(MessageInputSchema)
      .mutation(({ input }) => services.notifyLdapSyncFailed(input.message)),
    notifyAuthIntegrationFailed: publicProcedure
      .input(MessageInputSchema)
      .mutation(({ input }) => services.notifyAuthIntegrationFailed(input.message)),
    notifyQrSettingsChanged: publicProcedure
      .input(ChangedFieldsInputSchema)
      .mutation(({ input }) => services.notifyQrSettingsChanged(input.changedFields)),
    runDueAndOverdue: publicProcedure
      .input(runNotificationsInputSchema)
      .mutation(({ input }) =>
        services.runDueAndOverdueNotifications(input?.referenceDate ? new Date(input.referenceDate) : undefined),
      ),
    listForMe: publicProcedure.input(selfNotificationsListInputSchema).query(async ({ ctx, input }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user?.memberId) {
        return {
          notifications: [],
          unread: 0,
        }
      }

      const notifications = await services.listNotificationsForMember(user.memberId, input?.limit)
      const unread = notifications.filter((entry) => !entry.readAt).length
      return {
        notifications,
        unread,
      }
    }),
    markReadForMe: publicProcedure.input(selfNotificationMutationInputSchema).mutation(async ({ ctx, input }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user?.memberId) {
        return false
      }
      return services.markNotificationRead(input.id, user.memberId)
    }),
    removeForMe: publicProcedure.input(selfNotificationMutationInputSchema).mutation(async ({ ctx, input }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user?.memberId) {
        return false
      }
      return services.deleteNotification(input.id, user.memberId)
    }),
    markAllReadForMe: publicProcedure.mutation(async ({ ctx }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user?.memberId) {
        return
      }
      await services.markAllNotificationsRead(user.memberId)
    }),
    removeAllForMe: publicProcedure.mutation(async ({ ctx }) => {
      const user = await resolveAuthedUser(ctx)
      if (!user?.memberId) {
        return
      }
      await services.deleteAllNotifications(user.memberId)
    }),
  }),

  producers: createTrpcRouter({
    list: publicProcedure.query(() => services.listProducers()),
    importFromUrl: publicProcedure.input(importProducerByUrlInputSchema).mutation(async ({ input }) => {
      const imported = await importProducerFromWebsite(input.url)
      return services.createProducer(imported)
    }),
    create: publicProcedure.input(ProducerInputSchema).mutation(({ input }) => services.createProducer(input)),
    update: publicProcedure
      .input(updateProducerByIdInputSchema)
      .mutation(({ input }) => services.updateProducer(input.id, input.input)),
    remove: publicProcedure.input(IdInputSchema).mutation(({ input }) => services.deleteProducer(input.id)),
  }),

  settings: createTrpcRouter({
    general: publicProcedure.query(() => services.getSetupStatus()),
    saveGeneral: publicProcedure
      .input(SaveWorkspaceSettingsInputSchema)
      .mutation(({ input }) => services.saveWorkspaceSettings(input)),
    qrPublic: publicProcedure.query(() => services.getQrPublicSettings()),
    saveQrPublic: publicProcedure
      .input(SaveQrPublicSettingsInputSchema)
      .mutation(({ input }) => services.saveQrPublicSettings(input)),
    notificationPreferences: publicProcedure.query(() => services.getNotificationPreferences()),
    saveNotificationPreferences: publicProcedure
      .input(SaveNotificationPreferencesInputSchema)
      .mutation(({ input }) => services.saveNotificationPreferences(input)),
    securitySettings: publicProcedure.query(() => services.getSecuritySettings()),
    saveSecuritySettings: publicProcedure
      .input(SaveSecuritySettingsInputSchema)
      .mutation(({ input }) => services.saveSecuritySettings(input)),
    effectiveSecuritySettings: publicProcedure.query(() => services.getEffectiveSecuritySettings()),
    securityBundle: publicProcedure.query(async () => {
      const [settings, effective] = await Promise.all([
        services.getSecuritySettings(),
        services.getEffectiveSecuritySettings(),
      ])

      return {
        settings,
        effective: {
          trustedProxies: effective.trustedProxies,
          trustedDomains: effective.trustedDomains,
          trustedProxiesSource: effective.trustedProxiesSource,
          trustedDomainsSource: effective.trustedDomainsSource,
        },
      }
    }),
    healthStatus: publicProcedure.input(healthInputSchema).query(async ({ ctx }) => {
      const [security, dashboardStats] = await Promise.all([
        services.getEffectiveSecuritySettings(),
        services.getDashboardStats(),
      ])

      const host = ctx.req.headers.get("host") ?? ""
      const forwardedFor = ctx.req.headers.get("x-forwarded-for")
      const forwardedProto = ctx.req.headers.get("x-forwarded-proto")
      const forwardedHost = ctx.req.headers.get("x-forwarded-host")
      const protocol = new URL(ctx.req.url).protocol

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

      const issues: Array<{
        id: string
        title: string
        severity: "warning" | "critical"
        details: string
        fix: string
      }> = []

      if (!domainTrusted) {
        issues.push({
          id: "untrusted-domain",
          title: "Domain not trusted",
          severity: "critical",
          details: `Host "${host || "unknown"}" is not in trusted domains (${security.trustedDomainsSource}).`,
          fix:
            security.trustedDomainsSource === "env"
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
          fix:
            security.trustedProxiesSource === "env"
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

      return {
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
      }
    }),
  }),

  setup: createTrpcRouter({
    ensureSchema: publicProcedure.mutation(() => services.ensureCoreSchema()),
    status: publicProcedure.query(() => services.getSetupStatus()),
    completeInitial: publicProcedure
      .input(CompleteInitialSetupInputSchema)
      .mutation(({ input }) => services.completeInitialSetup(input)),
    saveWorkspaceSettings: publicProcedure
      .input(SaveWorkspaceSettingsInputSchema)
      .mutation(({ input }) => services.saveWorkspaceSettings(input)),
  }),
})

export type AppRouter = typeof appRouter
