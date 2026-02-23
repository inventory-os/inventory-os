import { NextResponse } from "next/server"
import {
  listAssets,
  listLocations,
  listManagedCategories,
  listMembers,
  listProducers,
} from "@/lib/core-repository"
import type { Asset } from "@/lib/data"

const MAX_QUERY_LENGTH = 120
const SECTION_LIMIT = 8

type AssetSearchResult = {
  asset: Asset
  matchType: "direct" | "related-member" | "related-producer" | "related-location" | "related-category"
}

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

function matchesAllTerms(searchable: string, terms: string[]): boolean {
  const text = normalize(searchable)
  return terms.every((term) => text.includes(term))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get("q") ?? ""
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH)

  if (!query) {
    return NextResponse.json({
      query: "",
      assets: [],
      producers: [],
      members: [],
      locations: [],
      categories: [],
    })
  }

  const terms = normalize(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const [assets, producers, members, locations, categories] = await Promise.all([
    listAssets(),
    listProducers(),
    listMembers(),
    listLocations(),
    listManagedCategories(),
  ])

  const matchedAssets = assets
    .filter((asset) =>
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
        [producer.id, producer.name, producer.domain, producer.websiteUrl, producer.sourceUrl, producer.description ?? ""].join(" "),
        terms,
      ),
    )
    .slice(0, SECTION_LIMIT)

  const matchedMembers = members
    .filter((member) => matchesAllTerms([member.id, member.name, member.email, member.role].join(" "), terms))
    .slice(0, SECTION_LIMIT)

  const matchedLocations = locations
    .filter((location) =>
      matchesAllTerms(
        [location.id, location.name, location.path, location.address, location.locationCode ?? "", location.kind].join(" "),
        terms,
      ),
    )
    .slice(0, SECTION_LIMIT)

  const matchedCategories = categories
    .filter((category) => matchesAllTerms([category.id, category.name].join(" "), terms))
    .slice(0, SECTION_LIMIT)

  const directAssetIds = new Set(matchedAssets.map((asset) => asset.id))
  const matchedMemberNames = new Set(matchedMembers.map((member) => normalize(member.name)))
  const matchedProducerNames = new Set(matchedProducers.map((producer) => normalize(producer.name)))
  const matchedLocationNames = matchedLocations.map((location) => normalize(location.name)).filter(Boolean)
  const matchedLocationPaths = matchedLocations.map((location) => normalize(location.path)).filter(Boolean)
  const matchedCategoryNames = matchedCategories.map((category) => normalize(category.name)).filter(Boolean)

  const relatedAssets: AssetSearchResult[] = []
  for (const asset of assets) {
    if (directAssetIds.has(asset.id)) {
      continue
    }

    const assignedTo = normalize(asset.assignedTo ?? "")
    const producerName = normalize(asset.producerName ?? "")
    const location = normalize(asset.location)
    const category = normalize(asset.category)

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
      (
        matchedLocationNames.some(
          (candidate) => candidate === location || candidate.includes(location) || location.includes(candidate),
        ) ||
        matchedLocationPaths.some((candidatePath) => candidatePath.includes(location))
      )

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
      continue
    }
  }

  const assetResults: AssetSearchResult[] = [
    ...matchedAssets.map((asset) => ({ asset, matchType: "direct" as const })),
    ...relatedAssets,
  ].slice(0, SECTION_LIMIT * 2)

  return NextResponse.json({
    query,
    assets: assetResults,
    producers: matchedProducers,
    members: matchedMembers,
    locations: matchedLocations,
    categories: matchedCategories,
  })
}
