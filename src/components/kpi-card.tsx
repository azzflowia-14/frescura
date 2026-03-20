import { type LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  color?: "default" | "green" | "red" | "orange" | "blue" | "yellow" | "purple" | "cyan"
  trend?: { value: number; label: string }
}

const colorMap = {
  default: "bg-white border-slate-200",
  green: "bg-emerald-50 border-emerald-200",
  red: "bg-red-50 border-red-200",
  orange: "bg-orange-50 border-orange-200",
  blue: "bg-blue-50 border-blue-200",
  yellow: "bg-amber-50 border-amber-200",
  purple: "bg-violet-50 border-violet-200",
  cyan: "bg-cyan-50 border-cyan-200",
}

const iconColorMap = {
  default: "text-slate-500 bg-slate-100",
  green: "text-emerald-600 bg-emerald-100",
  red: "text-red-600 bg-red-100",
  orange: "text-orange-600 bg-orange-100",
  blue: "text-blue-600 bg-blue-100",
  yellow: "text-amber-600 bg-amber-100",
  purple: "text-violet-600 bg-violet-100",
  cyan: "text-cyan-600 bg-cyan-100",
}

const valueColorMap = {
  default: "text-slate-800",
  green: "text-emerald-700",
  red: "text-red-700",
  orange: "text-orange-700",
  blue: "text-blue-700",
  yellow: "text-amber-700",
  purple: "text-violet-700",
  cyan: "text-cyan-700",
}

export function KpiCard({ title, value, subtitle, icon: Icon, color = "default", trend }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{title}</p>
          <p className={`text-2xl font-bold tabular-nums ${valueColorMap[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-red-600"}`}>
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
