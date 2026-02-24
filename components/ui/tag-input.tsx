"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TagInputProps = {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

function normalizeOneTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 40)
}

export function TagInput({ value, onChange, suggestions = [], placeholder, disabled, className }: TagInputProps) {
  const [draft, setDraft] = useState("")

  const usedKeys = useMemo(() => new Set(value.map((entry) => entry.toLowerCase())), [value])

  const suggestionList = useMemo(() => {
    const needle = draft.trim().toLowerCase()
    return suggestions
      .filter((entry) => {
        const key = entry.toLowerCase()
        if (usedKeys.has(key)) {
          return false
        }
        if (!needle) {
          return true
        }
        return key.includes(needle)
      })
      .slice(0, 8)
  }, [draft, suggestions, usedKeys])

  const commitTag = (raw: string) => {
    const normalized = normalizeOneTag(raw)
    if (!normalized) {
      return
    }

    const key = normalized.toLowerCase()
    if (usedKeys.has(key)) {
      setDraft("")
      return
    }

    onChange([...value, normalized])
    setDraft("")
  }

  const removeTag = (tag: string) => {
    const key = tag.toLowerCase()
    onChange(value.filter((entry) => entry.toLowerCase() !== key))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-lg border bg-background px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              <span>{tag}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-4"
                onClick={() => removeTag(tag)}
                disabled={disabled}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault()
                commitTag(draft)
              }
              if (event.key === "Backspace" && !draft && value.length > 0) {
                removeTag(value[value.length - 1] ?? "")
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                commitTag(draft)
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="h-7 min-w-[160px] flex-1 border-0 px-1 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {suggestionList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestionList.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 rounded-full px-2 text-xs"
              onClick={() => commitTag(tag)}
              disabled={disabled}
            >
              + {tag}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
