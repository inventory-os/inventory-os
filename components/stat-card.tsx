import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon }: StatCardProps) {
  return (
    <Card className="app-kpi group transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md hover:shadow-primary/5">
      <CardContent className="flex items-center justify-between p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {change && (
            <span
              className={cn(
                "text-xs font-medium",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground",
              )}
            >
              {change}
            </span>
          )}
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 transition-colors group-hover:bg-primary/15">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}
