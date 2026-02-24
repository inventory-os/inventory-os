"use client"

import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAppRuntime } from "@/components/app-runtime-provider"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const { t } = useAppRuntime()

  return (
    <Loader2Icon
      role="status"
      aria-label={t("uiLoading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
