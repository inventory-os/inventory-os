"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { EUROPEAN_LOCALES } from "@/lib/utils/i18n"
import { translate, type I18nKey, type TranslationParams } from "@/lib/utils/i18n"
import type { EuropeanLocale, SetupStatus } from "@/lib/types"
import { formatCurrencyValue, formatDateValue, normalizeCurrency } from "@/lib/utils/intl"
import { trpc } from "@/lib/trpc/react"

type RuntimeContextValue = {
  config: SetupStatus
  loading: boolean
  locale: EuropeanLocale
  setLocale: (locale: EuropeanLocale) => void
  refresh: () => Promise<void>
  t: (key: I18nKey, params?: TranslationParams) => string
  formatCurrency: (value: number, options?: { maximumFractionDigits?: number }) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const defaultConfig: SetupStatus = {
  setupComplete: false,
  appName: "Inventory OS",
  organizationName: "",
  locale: "en",
  currency: "EUR",
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null)
const LOCALE_STORAGE_KEY = "inventory-os.locale"

function isSupportedLocale(value: string): value is EuropeanLocale {
  return (EUROPEAN_LOCALES as string[]).includes(value)
}

function detectBrowserLocale(): EuropeanLocale {
  if (typeof navigator === "undefined") {
    return "en"
  }

  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().trim()
    if (!normalized) {
      continue
    }

    if (isSupportedLocale(normalized)) {
      return normalized
    }

    const base = normalized.split("-")[0]
    if (base && isSupportedLocale(base)) {
      return base
    }
  }

  return "en"
}

export function AppRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SetupStatus>(defaultConfig)
  const [localeOverride, setLocaleOverride] = useState<EuropeanLocale | null>(null)

  const setupStatusQuery = trpc.setup.status.useQuery(undefined, {
    staleTime: 60_000,
  })

  const loading = setupStatusQuery.isLoading

  useEffect(() => {
    if (setupStatusQuery.data) {
      setConfig(setupStatusQuery.data)
    }
  }, [setupStatusQuery.data])

  const refresh = useCallback(async () => {
    const payload = await setupStatusQuery.refetch()
    if (payload.data) {
      setConfig(payload.data)
    }
  }, [setupStatusQuery])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved && isSupportedLocale(saved)) {
      setLocaleOverride(saved)
      return
    }

    setLocaleOverride(detectBrowserLocale())
  }, [])

  const setLocale = useCallback((locale: EuropeanLocale) => {
    setLocaleOverride(locale)

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  }, [])

  const effectiveLocale = localeOverride ?? config.locale

  const t = useCallback(
    (key: I18nKey, params?: TranslationParams) => {
      return translate(effectiveLocale, key, params)
    },
    [effectiveLocale],
  )

  const formatCurrency = useCallback(
    (value: number, options?: { maximumFractionDigits?: number }) => {
      return formatCurrencyValue({
        value,
        locale: effectiveLocale,
        currency: normalizeCurrency(config.currency),
        maximumFractionDigits: options?.maximumFractionDigits,
      })
    },
    [config.currency, effectiveLocale],
  )

  const formatDate = useCallback(
    (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
      return formatDateValue({ value, locale: effectiveLocale, options })
    },
    [effectiveLocale],
  )

  const value = useMemo<RuntimeContextValue>(
    () => ({
      config,
      loading,
      locale: effectiveLocale,
      setLocale,
      refresh,
      t,
      formatCurrency,
      formatDate,
    }),
    [config, loading, effectiveLocale, setLocale, refresh, t, formatCurrency, formatDate],
  )

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useAppRuntime() {
  const context = useContext(RuntimeContext)
  if (!context) {
    throw new Error("useAppRuntime must be used within AppRuntimeProvider")
  }
  return context
}
