import type { EuropeanLocale } from "@/lib/data"

export function normalizeCurrency(input: string | null | undefined): string {
  const value = (input ?? "EUR").trim().toUpperCase()
  return /^[A-Z]{3}$/.test(value) ? value : "EUR"
}

export function localeTag(locale: EuropeanLocale | string | null | undefined): string {
  return (locale ?? "en").trim() || "en"
}

export function formatCurrencyValue(params: {
  value: number
  locale: EuropeanLocale | string
  currency: string
  maximumFractionDigits?: number
}): string {
  return new Intl.NumberFormat(localeTag(params.locale), {
    style: "currency",
    currency: normalizeCurrency(params.currency),
    maximumFractionDigits: params.maximumFractionDigits,
  }).format(params.value)
}

export function formatDateValue(params: {
  value: string | number | Date
  locale: EuropeanLocale | string
  options?: Intl.DateTimeFormatOptions
}): string {
  return new Intl.DateTimeFormat(localeTag(params.locale), params.options).format(new Date(params.value))
}