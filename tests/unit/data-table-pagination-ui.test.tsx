// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

describe("DataTablePagination UI", () => {
  it("disables previous button on first page", () => {
    render(<DataTablePagination page={1} pageSize={10} total={25} onPageChange={() => undefined} />)
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()
  })

  it("disables next button on last page", () => {
    render(<DataTablePagination page={3} pageSize={10} total={25} onPageChange={() => undefined} />)
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("emits page changes", () => {
    const onPageChange = vi.fn()
    render(<DataTablePagination page={2} pageSize={10} total={25} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Prev" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3)
  })
})
