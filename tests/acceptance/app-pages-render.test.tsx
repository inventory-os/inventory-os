// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const push = vi.fn()
const replace = vi.fn()
const searchParams = { get: () => null }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock("@/components/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}))

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ isAdmin: true, isLoading: false, loading: false, currentUser: null }),
}))

vi.mock("@/components/app-runtime-provider", () => ({
  useAppRuntime: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (values?.count !== undefined) return `${key}:${String(values.count)}`
      if (values?.percent !== undefined) return `${key}:${String(values.percent)}`
      return key
    },
    config: { currency: "EUR" },
    formatCurrency: (value: number) => `€${value}`,
    formatDate: (value: string) => value,
    refresh: vi.fn(),
  }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock("@/components/dashboard/asset-overview-chart", () => ({
  AssetOverviewChart: () => <div data-testid="asset-overview-chart" />,
}))

vi.mock("@/components/dashboard/status-distribution-chart", () => ({
  StatusDistributionChart: () => <div data-testid="status-distribution-chart" />,
}))

vi.mock("@/components/dashboard/inventory-value-chart", () => ({
  InventoryValueChart: () => <div data-testid="inventory-value-chart" />,
}))

vi.mock("@/components/dashboard/top-categories", () => ({
  TopCategories: () => <div data-testid="top-categories" />,
}))

vi.mock("@/components/assets/asset-table", () => ({
  AssetTable: () => <div data-testid="asset-table" />,
}))

vi.mock("@/components/assets/asset-filters", () => ({
  AssetFilters: () => <div data-testid="asset-filters" />,
}))

vi.mock("@/components/assets/asset-detail-info", () => ({
  AssetDetailInfo: () => <div data-testid="asset-detail-info" />,
  AssetCustodyHistory: () => <div data-testid="asset-custody-history" />,
}))

vi.mock("@/components/assets/asset-location-map", () => ({
  AssetLocationMap: () => <div data-testid="asset-location-map" />,
}))

function mockFetchResponse(url: string) {
  if (url.startsWith("/api/stats")) {
    return {
      ok: true,
      json: async () => ({
        stats: {
          totalAssets: 12,
          activeUsers: 5,
          locations: 3,
          maintenance: 2,
          inventoryValue: 45600,
          monthlyAssetGrowth: [{ month: "Jan", assets: 2 }],
          statusDistribution: [{ name: "available", value: 8, color: "#fff" }],
          inventoryValueByCategory: [{ category: "Laptops", value: 12000 }],
        },
      }),
    }
  }

  if (url.startsWith("/api/loans")) {
    return {
      ok: true,
      json: async () => ({
        loans: [
          {
            id: "LON-1",
            assetId: "AST-1",
            assetName: "MacBook",
            memberId: "USR-1",
            memberName: "Alex Johnson",
            dueAt: null,
            borrowedAt: new Date().toISOString(),
            returnedAt: null,
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/members/USR-1")) {
    return {
      ok: true,
      json: async () => ({
        member: { id: "USR-1", name: "Alex Johnson", email: "alex@example.com", role: "member", avatar: "AJ", assetsAssigned: 2 },
        assignedAssets: [
          { id: "AST-1", name: "MacBook", category: "Laptops", status: "available", location: "HQ" },
        ],
        loanHistory: [
          {
            id: "LON-1",
            assetId: "AST-1",
            assetName: "MacBook",
            memberId: "USR-1",
            memberName: "Alex Johnson",
            dueAt: null,
            borrowedAt: new Date().toISOString(),
            returnedAt: null,
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/assets?page=1&pageSize=100")) {
    return {
      ok: true,
      json: async () => ({ assets: [{ id: "AST-1", name: "MacBook", status: "available" }] }),
    }
  }

  if (url.startsWith("/api/assets?page=1&pageSize=200")) {
    return {
      ok: true,
      json: async () => ({
        assets: [
          {
            id: "AST-1",
            name: "MacBook",
            serialNumber: "SER-1",
            category: "Laptops",
            status: "available",
            location: "HQ",
            locationId: "LOC-1",
            assignedTo: null,
            assignedToMemberId: null,
            value: 1500,
            purchaseDate: "2024-01-01",
            producerId: null,
            producerName: null,
            parentAssetId: null,
            tags: [],
            notes: null,
            model: null,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/assets/AST-1/files")) {
    return {
      ok: true,
      json: async () => ({ files: [] }),
    }
  }

  if (url.startsWith("/api/assets/AST-1")) {
    return {
      ok: true,
      json: async () => ({
        asset: {
          id: "AST-1",
          name: "MacBook",
          serialNumber: "SER-1",
          category: "Laptops",
          status: "available",
          location: "HQ",
          locationId: "LOC-1",
          assignedTo: null,
          assignedToMemberId: null,
          value: 1500,
          purchaseDate: "2024-01-01",
          producerId: null,
          producerName: null,
          parentAssetId: null,
          tags: ["portable"],
          notes: null,
          model: null,
          sku: null,
          supplier: null,
          warrantyUntil: null,
          condition: "good",
          quantity: 1,
          minimumQuantity: 0,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
        history: [],
        incidents: [],
        children: [],
      }),
    }
  }

  if (url.startsWith("/api/assets?")) {
    return {
      ok: true,
      json: async () => ({
        assets: [
          {
            id: "AST-1",
            name: "MacBook",
            serialNumber: "SER-1",
            category: "Laptops",
            status: "available",
            location: "HQ",
            locationId: "LOC-1",
            assignedTo: null,
            assignedToMemberId: null,
            value: 1500,
            purchaseDate: "2024-01-01",
            producerId: null,
            producerName: null,
            parentAssetId: null,
            tags: ["portable"],
            notes: null,
            model: null,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
          },
        ],
        pagination: { total: 1 },
      }),
    }
  }

  if (url.startsWith("/api/locations")) {
    return {
      ok: true,
      json: async () => ({
        locations: [
          {
            id: "LOC-1",
            name: "HQ",
            kind: "building",
            parentId: null,
            addressId: "ADR-1",
            floorNumber: null,
            roomNumber: null,
            path: "HQ",
            assetCount: 2,
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/addresses")) {
    return {
      ok: true,
      json: async () => ({
        addresses: [
          {
            id: "ADR-1",
            label: "HQ",
            addressLine1: "Main Street 1",
            addressLine2: null,
            postalCode: "10115",
            city: "Berlin",
            country: "DE",
            locationCount: 1,
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/tags")) {
    return {
      ok: true,
      json: async () => ({ tags: [{ name: "portable", count: 1 }] }),
    }
  }

  if (url.startsWith("/api/members?page=1&pageSize=100")) {
    return {
      ok: true,
      json: async () => ({ members: [{ id: "USR-1", name: "Alex Johnson", email: "alex@example.com", role: "member", assetsAssigned: 1 }] }),
    }
  }

  if (url.startsWith("/api/assets/AST-1/borrow")) {
    return {
      ok: true,
      json: async () => ({ success: true }),
    }
  }

  if (url.startsWith("/api/categories")) {
    return {
      ok: true,
      json: async () => ({
        managedCategories: [{ id: "CAT-1", name: "Laptops", assetCount: 3 }],
        pagination: { total: 1 },
      }),
    }
  }

  if (url.startsWith("/api/producers")) {
    return {
      ok: true,
      json: async () => ({
        producers: [
          {
            id: "PRD-1",
            name: "Apple",
            websiteUrl: "https://apple.com",
            domain: "apple.com",
            description: "Producer",
            logoUrl: null,
            sourceUrl: "https://apple.com",
            createdAt: "2024-01-01",
          },
        ],
      }),
    }
  }

  if (url.startsWith("/api/search")) {
    return {
      ok: true,
      json: async () => ({
        query: "mac",
        assets: [
          {
            matchType: "direct",
            asset: {
              id: "AST-1",
              name: "MacBook",
              serialNumber: "SER-1",
              category: "Laptops",
              status: "available",
              location: "HQ",
              locationId: "LOC-1",
              assignedTo: null,
              assignedToMemberId: null,
              value: 1500,
              purchaseDate: "2024-01-01",
              producerId: null,
              producerName: null,
              parentAssetId: null,
              tags: [],
              notes: null,
              model: null,
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
            },
          },
        ],
        producers: [],
        members: [],
        locations: [],
        categories: [],
      }),
    }
  }

  if (url.startsWith("/api/incidents?")) {
    return {
      ok: true,
      json: async () => ({
        incidents: [
          {
            id: "INC-1",
            assetId: "AST-1",
            assetName: "MacBook",
            incidentType: "damage",
            title: "Screen damage",
            description: "Display cracked",
            severity: "high",
            status: "open",
            reportedBy: "Alex",
            occurredAt: "2024-01-01",
            estimatedRepairCost: 200,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
          },
        ],
        counts: { open: 1, investigating: 0, resolved: 0, critical: 0 },
        pagination: { total: 1 },
      }),
    }
  }

  if (url.startsWith("/api/incidents/INC-1/files")) {
    return {
      ok: true,
      json: async () => ({ files: [] }),
    }
  }

  if (url.startsWith("/api/incidents/INC-1")) {
    return {
      ok: true,
      json: async () => ({
        incident: {
          id: "INC-1",
          assetId: "AST-1",
          assetName: "MacBook",
          incidentType: "damage",
          title: "Screen damage",
          description: "Display cracked",
          severity: "high",
          status: "open",
          reportedBy: "Alex",
          occurredAt: "2024-01-01",
          estimatedRepairCost: 200,
          resolutionNotes: null,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      }),
    }
  }

  if (url.startsWith("/api/locations/LOC-1?")) {
    return {
      ok: true,
      json: async () => ({
        location: {
          id: "LOC-1",
          name: "HQ",
          kind: "building",
          parentId: null,
          path: "HQ",
          address: "Main Street 1, Berlin",
          assetCount: 1,
        },
        parent: null,
        children: [],
        assets: [
          {
            id: "AST-1",
            name: "MacBook",
            serialNumber: "SER-1",
            category: "Laptops",
            status: "available",
            location: "HQ",
            locationId: "LOC-1",
            assignedTo: null,
            assignedToMemberId: null,
            value: 1500,
            purchaseDate: "2024-01-01",
            producerId: null,
            producerName: null,
            parentAssetId: null,
            tags: [],
            notes: null,
            model: null,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
          },
        ],
        assetCategories: ["Laptops"],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        qrPayload: "https://example.com/qr/LOC-1",
      }),
    }
  }

  if (url.startsWith("/api/qr/QR-1")) {
    return {
      ok: true,
      json: async () => ({
        found: true,
        authenticated: false,
        redirectTo: null,
        entity: { type: "asset", id: "AST-1", name: "MacBook" },
        public: {
          ownerLabel: "Inventory OS",
          message: "Call support",
          showLoginButton: true,
          loginButtonText: "Sign in",
          logoUrl: "",
          contactPhone: "",
          contactEmail: "",
          websiteUrl: "",
          extraLinks: [],
          selectedAddress: null,
          loginUrl: "/login",
        },
      }),
    }
  }

  if (url.startsWith("/api/settings/general")) {
    return {
      ok: true,
      json: async () => ({ settings: { appName: "Inventory OS", organizationName: "Org", locale: "en", currency: "EUR" } }),
    }
  }

  if (url.startsWith("/api/integrations/ldap")) {
    return {
      ok: true,
      json: async () => ({ settings: { enabled: false, url: "", bindDn: "", baseDn: "", userFilter: "(objectClass=person)", usernameAttribute: "uid", emailAttribute: "mail", nameAttribute: "cn", defaultRole: "member", syncIssuer: "", hasBindPassword: false, updatedAt: null } }),
    }
  }

  if (url.startsWith("/api/settings/qr")) {
    return {
      ok: true,
      json: async () => ({ settings: { enabled: true, ownerLabel: "Org", publicMessage: "Welcome", showLoginButton: true, loginButtonText: "Sign in", selectedAddressId: null, logoUrl: "", contactPhone: "", contactEmail: "", websiteUrl: "", extraLinks: [], updatedAt: null } }),
    }
  }

  if (url.startsWith("/api/settings/notifications")) {
    return {
      ok: true,
      json: async () => ({ settings: { checkoutAlerts: true, maintenanceAlerts: true, bookingAlerts: true, digestEnabled: false, lowInventoryAlerts: false, updatedAt: null } }),
    }
  }

  if (url.startsWith("/api/settings/security")) {
    return {
      ok: true,
      json: async () => ({
        settings: { trustedProxies: ["127.0.0.1"], trustedDomains: ["example.com"], updatedAt: null },
        effective: { trustedProxies: ["127.0.0.1"], trustedDomains: ["example.com"], trustedProxiesSource: "db", trustedDomainsSource: "db" },
      }),
    }
  }

  if (url.startsWith("/api/settings/health")) {
    return {
      ok: true,
      json: async () => ({
        checkedAt: new Date().toISOString(),
        overallOk: true,
        checks: { proxy: true, tls: true, database: true, memory: true },
        issues: [],
        proxy: { ok: true, host: "localhost", forwardedFor: null, trustedDomainsConfigured: 1, trustedProxiesConfigured: 1, trustedDomainsSource: "db", trustedProxiesSource: "db" },
        tls: { ok: true, protocol: "https", forwardedProto: "https" },
        server: { nodeVersion: "v22", platform: "darwin", arch: "arm64", uptimeSeconds: 120, cpuCount: 8, memory: { usagePercent: 30 } },
        stats: { totalAssets: 10, activeUsers: 2, locations: 1, maintenance: 0, inventoryValue: 2000 },
      }),
    }
  }

  if (url.startsWith("/api/members")) {
    return {
      ok: true,
      json: async () => ({
        members: [{ id: "USR-1", name: "Alex Johnson", email: "alex@example.com", role: "member", assetsAssigned: 2 }],
        pagination: { total: 1 },
      }),
    }
  }

  return {
    ok: true,
    json: async () => ({}),
  }
}

describe("App pages render acceptance", () => {
  beforeEach(() => {
    push.mockReset()
    replace.mockReset()
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        return mockFetchResponse(url)
      }),
    )
  })

  it("renders dashboard and loads stats", async () => {
    const mod = await import("@/app/page")
    const DashboardPage = mod.default

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("navDashboard")).toBeInTheDocument()
      expect(screen.getByText("12")).toBeInTheDocument()
    })
  })

  it("renders bookings and opens create booking flow", async () => {
    const mod = await import("@/app/bookings/page")
    const BookingsPage = mod.default

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByText("bookingsSubtitle")).toBeInTheDocument()
      expect(screen.getByText("MacBook")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "bookingsNew" }))

    await waitFor(() => {
      expect(screen.getByText("bookingsCreateTitle")).toBeInTheDocument()
    })
  })

  it("renders categories and supports searching", async () => {
    const mod = await import("@/app/categories/page")
    const CategoriesPage = mod.default

    render(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Laptops")).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText("categoriesSearch")
    fireEvent.change(input, { target: { value: "Lap" } })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("Lap")
    })
  })

  it("renders team page and toggles sorting", async () => {
    const mod = await import("@/app/team/page")
    const TeamPage = mod.default

    render(<TeamPage />)

    await waitFor(() => {
      expect(screen.getByText("teamMembersTitle")).toBeInTheDocument()
      expect(screen.getByText("alex@example.com")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /commonEmail/i }))

    expect(screen.getByText("alex@example.com")).toBeInTheDocument()
  })

  it("renders assets page", async () => {
    const mod = await import("@/app/assets/page")
    const AssetsPage = mod.default

    render(<AssetsPage />)

    await waitFor(() => {
      expect(screen.getByText("navAssets")).toBeInTheDocument()
      expect(screen.getByTestId("asset-table")).toBeInTheDocument()
    })
  })

  it("renders incidents page", async () => {
    const mod = await import("@/app/incidents/page")
    const IncidentsPage = mod.default

    render(<IncidentsPage />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "incidentsTitle" })).toBeInTheDocument()
      expect(screen.getByText("Screen damage")).toBeInTheDocument()
    })
  })

  it("renders locations page", async () => {
    const mod = await import("@/app/locations/page")
    const LocationsPage = mod.default

    render(<LocationsPage />)

    await waitFor(() => {
      expect(screen.getByText("navLocations")).toBeInTheDocument()
      expect(screen.getByText("locationsSubtitle")).toBeInTheDocument()
    })
  })

  it("renders producers page", async () => {
    const mod = await import("@/app/producers/page")
    const ProducersPage = mod.default

    render(<ProducersPage />)

    await waitFor(() => {
      expect(screen.getByText("navProducers")).toBeInTheDocument()
      expect(screen.getByText("Apple")).toBeInTheDocument()
    })
  })

  it("renders search page and submits query", async () => {
    const mod = await import("@/app/search/page")
    const SearchPage = mod.default

    render(<SearchPage />)

    const input = screen.getByPlaceholderText("globalSearchPlaceholder")
    fireEvent.change(input, { target: { value: "mac" } })
    fireEvent.click(screen.getByRole("button", { name: "globalSearchButton" }))

    expect(push).toHaveBeenCalled()
  })

  it("renders health page", async () => {
    const mod = await import("@/app/health/page")
    const HealthPage = mod.default

    render(<HealthPage />)

    await waitFor(() => {
      expect(screen.getByText("healthSubtitle")).toBeInTheDocument()
      expect(screen.getByText("settingsHealthOverall")).toBeInTheDocument()
    })
  })

  it("renders settings page", async () => {
    const mod = await import("@/app/settings/page")
    const SettingsPage = mod.default

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText("navSettings")).toBeInTheDocument()
      expect(screen.getByText("settingsGeneral")).toBeInTheDocument()
    })
  })

})
