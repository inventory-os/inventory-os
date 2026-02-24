"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type SearchableSelectItem = {
  value: string
  label: string
  description?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  items,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  items: SearchableSelectItem[]
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => items.find((item) => item.value === value) ?? null, [items, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.description ?? ""}`}
                  onSelect={() => {
                    onValueChange(item.value)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.label}</p>
                    {item.description ? (
                      <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  <Check className={cn("ml-2 size-4", value === item.value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
