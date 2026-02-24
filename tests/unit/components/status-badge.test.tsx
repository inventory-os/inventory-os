// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "@/components/status-badge"

describe("StatusBadge UI", () => {
  it("renders available label", () => {
    render(<StatusBadge status="available" />)
    expect(screen.getByText("Available")).toBeInTheDocument()
  })

  it("renders in-use label", () => {
    render(<StatusBadge status="in-use" />)
    expect(screen.getByText("In Use")).toBeInTheDocument()
  })

  it("renders maintenance label", () => {
    render(<StatusBadge status="maintenance" />)
    expect(screen.getByText("Maintenance")).toBeInTheDocument()
  })

  it("renders retired label", () => {
    render(<StatusBadge status="retired" />)
    expect(screen.getByText("Retired")).toBeInTheDocument()
  })
})
