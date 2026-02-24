import type { Asset, AssetFile } from "@/lib/types"
import { createAssetsRepository } from "@/lib/repository/domains/assets.repository"
import type { AssetsRepository } from "@/lib/repository/domains/assets.repository"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import {
  getAssetHistory as repositoryGetAssetHistory,
  getOpenLoanForAsset as repositoryGetOpenLoanForAsset,
} from "@/lib/repository/domains/assets.repository"
import {
  BorrowAssetInputSchema,
  type BorrowAssetInput,
  CreateAssetFileRecordInputSchema,
  type CreateAssetFileRecordInput,
  CreateAssetInputSchema,
  type CreateAssetInput,
  UpdateAssetInputSchema,
  type UpdateAssetInput,
} from "@/lib/types/assets"

type AssetsServiceDeps = {
  repository: AssetsRepository
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of tags) {
    const value = raw.trim().replace(/\s+/g, " ")
    if (!value) {
      continue
    }

    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(value.slice(0, 40))

    if (normalized.length >= 20) {
      break
    }
  }

  return normalized
}

function sanitizeAssetInput(input: CreateAssetInput | UpdateAssetInput): CreateAssetInput | UpdateAssetInput {
  return {
    ...input,
    name: input.name.trim(),
    category: input.category.trim(),
    model: input.model?.trim() || null,
    serialNumber: input.serialNumber?.trim() || null,
    sku: input.sku?.trim() || null,
    supplier: input.supplier?.trim() || null,
    warrantyUntil: input.warrantyUntil?.trim() || null,
    notes: input.notes?.trim() || null,
    tags: normalizeTags(input.tags),
  }
}

export function createAssetsService(deps: AssetsServiceDeps) {
  const repository = deps.repository

  return {
    listAssets(): Promise<Asset[]> {
      return repository.listAssets()
    },

    getAssetById(id: string): Promise<Asset | null> {
      return repository.getAssetById(id)
    },

    createAsset(input: CreateAssetInput): Promise<Asset> {
      const parsed = CreateAssetInputSchema.parse(input)
      return repository.createAsset(sanitizeAssetInput(parsed))
    },

    duplicateAsset(sourceAssetId: string): Promise<Asset | null> {
      return repository.duplicateAsset(sourceAssetId)
    },

    updateAsset(id: string, input: UpdateAssetInput): Promise<Asset | null> {
      const parsed = UpdateAssetInputSchema.parse(input)
      return repository.updateAsset(id, sanitizeAssetInput(parsed))
    },

    deleteAsset(id: string): Promise<boolean> {
      return repository.deleteAsset(id)
    },

    listAssetChildren(parentAssetId: string): Promise<Asset[]> {
      return repository.listAssetChildren(parentAssetId)
    },

    listAssetTags(): Promise<Array<{ name: string; count: number }>> {
      return repository.listAssetTags()
    },

    listAssetFiles(assetId: string): Promise<AssetFile[]> {
      return repository.listAssetFiles(assetId)
    },

    createAssetFileRecord(input: CreateAssetFileRecordInput): Promise<AssetFile> {
      const parsed = CreateAssetFileRecordInputSchema.parse(input)
      return repository.createAssetFileRecord(parsed)
    },

    getAssetFileById(assetId: string, fileId: string): Promise<(AssetFile & { storageKey: string }) | null> {
      return repository.getAssetFileById(assetId, fileId)
    },

    deleteAssetFileRecord(assetId: string, fileId: string): Promise<{ storageKey: string } | null> {
      return repository.deleteAssetFileRecord(assetId, fileId)
    },

    listAssetsByLocationTree(locationId: string): Promise<Asset[]> {
      return repository.listAssetsByLocationTree(locationId)
    },

    borrowAsset(input: BorrowAssetInput): Promise<Asset | null> {
      const parsed = BorrowAssetInputSchema.parse(input)
      return repository.borrowAsset(parsed)
    },

    returnAsset(assetId: string): Promise<Asset | null> {
      return repository.returnAsset(assetId)
    },
  }
}

export type AssetsService = ReturnType<typeof createAssetsService>

const repository = createAssetsRepository({ ensureCoreSchema })
const service = createAssetsService({ repository })

export const listAssets = (...args: Parameters<typeof service.listAssets>): ReturnType<typeof service.listAssets> =>
  service.listAssets(...args)
export const getAssetById = (
  ...args: Parameters<typeof service.getAssetById>
): ReturnType<typeof service.getAssetById> => service.getAssetById(...args)
export const createAsset = (...args: Parameters<typeof service.createAsset>): ReturnType<typeof service.createAsset> =>
  service.createAsset(...args)
export const duplicateAsset = (
  ...args: Parameters<typeof service.duplicateAsset>
): ReturnType<typeof service.duplicateAsset> => service.duplicateAsset(...args)
export const updateAsset = (...args: Parameters<typeof service.updateAsset>): ReturnType<typeof service.updateAsset> =>
  service.updateAsset(...args)
export const deleteAsset = (...args: Parameters<typeof service.deleteAsset>): ReturnType<typeof service.deleteAsset> =>
  service.deleteAsset(...args)
export const listAssetChildren = (
  ...args: Parameters<typeof service.listAssetChildren>
): ReturnType<typeof service.listAssetChildren> => service.listAssetChildren(...args)
export const listAssetTags = (
  ...args: Parameters<typeof service.listAssetTags>
): ReturnType<typeof service.listAssetTags> => service.listAssetTags(...args)
export const listAssetFiles = (
  ...args: Parameters<typeof service.listAssetFiles>
): ReturnType<typeof service.listAssetFiles> => service.listAssetFiles(...args)
export const createAssetFileRecord = (
  ...args: Parameters<typeof service.createAssetFileRecord>
): ReturnType<typeof service.createAssetFileRecord> => service.createAssetFileRecord(...args)
export const getAssetFileById = (
  ...args: Parameters<typeof service.getAssetFileById>
): ReturnType<typeof service.getAssetFileById> => service.getAssetFileById(...args)
export const deleteAssetFileRecord = (
  ...args: Parameters<typeof service.deleteAssetFileRecord>
): ReturnType<typeof service.deleteAssetFileRecord> => service.deleteAssetFileRecord(...args)
export const listAssetsByLocationTree = (
  ...args: Parameters<typeof service.listAssetsByLocationTree>
): ReturnType<typeof service.listAssetsByLocationTree> => service.listAssetsByLocationTree(...args)
export const borrowAsset = (...args: Parameters<typeof service.borrowAsset>): ReturnType<typeof service.borrowAsset> =>
  service.borrowAsset(...args)
export const returnAsset = (...args: Parameters<typeof service.returnAsset>): ReturnType<typeof service.returnAsset> =>
  service.returnAsset(...args)
export const getOpenLoanForAsset = (
  ...args: Parameters<typeof repositoryGetOpenLoanForAsset>
): ReturnType<typeof repositoryGetOpenLoanForAsset> => repositoryGetOpenLoanForAsset(...args)
export const getAssetHistory = (
  ...args: Parameters<typeof repositoryGetAssetHistory>
): ReturnType<typeof repositoryGetAssetHistory> => repositoryGetAssetHistory(...args)
