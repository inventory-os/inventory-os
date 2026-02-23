import { NextResponse } from "next/server"
import { z } from "zod"
import { createCategory, getCategorySummary, listManagedCategories } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
})

export async function GET(request: Request) {
  const [categories, managedCategories] = await Promise.all([getCategorySummary(), listManagedCategories()])

  const searchParams = new URL(request.url).searchParams
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? 10) || 10
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const search = (searchParams.get("search") ?? "").trim().toLowerCase()

  const terms = search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filteredManagedCategories = managedCategories.filter((category) => {
    const searchable = `${category.name} ${category.id}`.toLowerCase()
    return terms.length === 0 || terms.every((term) => searchable.includes(term))
  })

  const total = filteredManagedCategories.length
  const start = (page - 1) * pageSize
  const pagedManagedCategories = filteredManagedCategories.slice(start, start + pageSize)

  return NextResponse.json({
    categories,
    managedCategories: pagedManagedCategories,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = createCategorySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const category = await createCategory(parsed.data.name)
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to create category") }, { status: 400 })
  }
}
