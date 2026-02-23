import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-session"
import { findAuthUserById, findMemberIdByEmail, getAssetById, getLocationById, getQrPublicSettings, getSetupStatus, listAddresses, recordActivityEvent } from "@/lib/core-repository"

type QrEntity =
  | { type: "asset"; id: string; name: string; redirectTo: string }
  | { type: "location"; id: string; name: string; redirectTo: string }

async function resolveEntity(id: string): Promise<QrEntity | null> {
  const asset = await getAssetById(id)
  if (asset) {
    return { type: "asset", id: asset.id, name: asset.name, redirectTo: `/assets/${asset.id}` }
  }

  const location = await getLocationById(id)
  if (location) {
    return { type: "location", id: location.id, name: location.name, redirectTo: `/locations/${location.id}` }
  }

  return null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [entity, qrSettings, setup, addresses] = await Promise.all([
    resolveEntity(id),
    getQrPublicSettings(),
    getSetupStatus(),
    listAddresses(),
  ])

  if (!entity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const authenticated = Boolean(authUser?.active)
  const actorName = authUser?.displayName ?? "Public user"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  await recordActivityEvent({
    type: "qr.scan",
    actorMemberId,
    actorName,
    subjectType: entity.type,
    subjectId: entity.id,
    subjectName: entity.name,
    message: `${actorName} scanned ${entity.type} ${entity.name}.`,
  })

  if (authenticated) {
    return NextResponse.json({
      found: true,
      authenticated: true,
      redirectTo: entity.redirectTo,
      entity: {
        type: entity.type,
        id: entity.id,
        name: entity.name,
      },
    })
  }

  if (!qrSettings.enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const selectedAddress = qrSettings.selectedAddressId
    ? addresses.find((entry) => entry.id === qrSettings.selectedAddressId) ?? null
    : null

  return NextResponse.json({
    found: true,
    authenticated: false,
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
  })
}
