import { NextResponse } from "next/server"
import { z } from "zod"
import { createMember, listMembers } from "@/lib/core-repository"

const createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
})

export async function GET(request: Request) {
  const members = await listMembers()

  const searchParams = new URL(request.url).searchParams
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? 10) || 10
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const search = (searchParams.get("search") ?? "").trim().toLowerCase()
  const role = (searchParams.get("role") ?? "all").trim().toLowerCase()

  const terms = search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filteredMembers = members.filter((member) => {
    const searchable = [member.id, member.name, member.email, member.role].join(" ").toLowerCase()
    const matchesSearch = terms.length === 0 || terms.every((term) => searchable.includes(term))
    const matchesRole = role === "all" || member.role === role
    return matchesSearch && matchesRole
  })

  const total = filteredMembers.length
  const start = (page - 1) * pageSize
  const pagedMembers = filteredMembers.slice(start, start + pageSize)

  return NextResponse.json({
    members: pagedMembers,
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
  const parsed = createMemberSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const member = await createMember(parsed.data)
  return NextResponse.json({ member }, { status: 201 })
}
