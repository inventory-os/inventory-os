import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssetStatus } from "@/lib/types"

const statusConfig: Record<AssetStatus, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "bg-success/10 text-success border-success/20",
  },
  "in-use": {
    label: "In Use",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-warning/10 text-warning-foreground border-warning/20",
  },
  retired: {
    label: "Retired",
    className: "bg-muted text-muted-foreground border-border",
  },
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", config.className)}>
      {config.label}
    </Badge>
  )
}
