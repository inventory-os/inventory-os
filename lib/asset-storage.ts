import { randomUUID } from "node:crypto"
import path from "node:path"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"

function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
  return cleaned.slice(0, 120) || "file"
}

function getRootStorageDir(): string {
  const configured = process.env.ASSET_STORAGE_DIR?.trim()
  if (!configured) {
    return path.resolve(process.cwd(), "storage", "assets")
  }

  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
}

function getIncidentStorageDir(): string {
  const configured = process.env.INCIDENT_STORAGE_DIR?.trim()
  if (!configured) {
    return path.resolve(process.cwd(), "storage", "incidents")
  }

  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
}

export async function storeAssetFile(params: {
  assetId: string
  originalName: string
  content: Buffer
}): Promise<{ storageKey: string; absolutePath: string; sizeBytes: number }> {
  const root = getRootStorageDir()
  const assetDir = path.join(root, params.assetId)
  await mkdir(assetDir, { recursive: true })

  const safeName = sanitizeFileName(params.originalName)
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
  const absolutePath = path.join(assetDir, fileName)
  await writeFile(absolutePath, params.content)

  const fileStat = await stat(absolutePath)
  const storageKey = `${params.assetId}/${fileName}`

  return { storageKey, absolutePath, sizeBytes: fileStat.size }
}

export async function readStoredAssetFile(storageKey: string): Promise<Buffer> {
  const root = getRootStorageDir()
  const absolutePath = path.join(root, storageKey)
  return readFile(absolutePath)
}

export async function removeStoredAssetFile(storageKey: string): Promise<void> {
  const root = getRootStorageDir()
  const absolutePath = path.join(root, storageKey)
  await rm(absolutePath, { force: true })
}

export async function storeIncidentFile(params: {
  incidentId: string
  originalName: string
  content: Buffer
}): Promise<{ storageKey: string; absolutePath: string; sizeBytes: number }> {
  const root = getIncidentStorageDir()
  const incidentDir = path.join(root, params.incidentId)
  await mkdir(incidentDir, { recursive: true })

  const safeName = sanitizeFileName(params.originalName)
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
  const absolutePath = path.join(incidentDir, fileName)
  await writeFile(absolutePath, params.content)

  const fileStat = await stat(absolutePath)
  const storageKey = `${params.incidentId}/${fileName}`

  return { storageKey, absolutePath, sizeBytes: fileStat.size }
}

export async function readStoredIncidentFile(storageKey: string): Promise<Buffer> {
  const root = getIncidentStorageDir()
  const absolutePath = path.join(root, storageKey)
  return readFile(absolutePath)
}

export async function removeStoredIncidentFile(storageKey: string): Promise<void> {
  const root = getIncidentStorageDir()
  const absolutePath = path.join(root, storageKey)
  await rm(absolutePath, { force: true })
}
