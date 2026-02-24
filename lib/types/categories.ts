import { z } from "zod"

export interface AssetCategorySummary {
  name: string
  count: number
  color: string
}

export interface ManagedCategory {
  id: string
  name: string
  assetCount: number
}

export const ASSET_CATEGORIES = [
  "IT Equipment",
  "Electronics",
  "Furniture",
  "Audio/Video",
  "Tools",
  "Vehicles",
] as const

export const DEFAULT_UNCATEGORIZED_CATEGORY = "Uncategorized"

export const CATEGORY_COLORS: Record<string, string> = {
  "IT Equipment": "bg-chart-1",
  Electronics: "bg-chart-2",
  Furniture: "bg-chart-3",
  "Audio/Video": "bg-chart-4",
  Tools: "bg-chart-5",
  Vehicles: "bg-primary",
}

export const CategoryNameSchema = z.string().min(1)
export type CategoryName = z.infer<typeof CategoryNameSchema>
