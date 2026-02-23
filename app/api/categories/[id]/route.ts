import { NextResponse } from "next/server"
import { z } from "zod"
import { deleteCategory, updateCategory } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateCategorySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const category = await updateCategory(id, parsed.data.name)
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }
    return NextResponse.json({ category })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to update category") }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const deleted = await deleteCategory(id)
    if (!deleted) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to delete category") }, { status: 400 })
  }
}
