import { type LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  color?: "default" | "green" | "red" | "orange" | "blue" | "yellow"
  trend?: { value: number; label: string }
}

const colorMap = {
  default: "bg-zinc-800/50 border-zinc-700/50",
  green: "bg-emerald-950/30 border-emerald-800/40",
  red: "bg-red-950/30 border-red-800/40",
  orange: "bg-orange-950/30 border-orange-800/40",
  blue: "bg-blue-950/30 border-blue-800/40",
  yellow: "bg-yellow-950/30 border-yellow-800/40",
}

const iconColorMap = {
  default: "text-zinc-400 bg-zinc-800",
  green: "text-emerald-400 bg-emerald-900/50",
  red: "text-red-400 bg-red-900/50",
  orange: "text-orange-400 bg-orange-900/50",
  blue: "text-blue-400 bg-blue-900/50",
  yellow: "text-yellow-400 bg-yellow-900/50",
}

const valueColorMap = {
  default: "text-white",
  green: "text-emerald-400",
  red: "text-red-400",
  orange: "text-orange-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
}

export function KpiCard({ title, value, subtitle, icon: Icon, color = "default", trend }: KpiCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold tabular-nums ${valueColorMap[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          {trend && (
            <p className={`text-xs ${trend.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconColorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}
