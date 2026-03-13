const DIVISION_COLORS: Record<string, string> = {
  "CERVEZAS": "bg-amber-100 text-amber-800",
  "GASEOSAS": "bg-blue-100 text-blue-800",
  "AGUAS": "bg-cyan-100 text-cyan-800",
  "AGUAS ECO": "bg-teal-100 text-teal-800",
  "ENERGIZANTES": "bg-lime-100 text-lime-800",
  "JUGOS": "bg-orange-100 text-orange-800",
  "ISOTONICOS": "bg-green-100 text-green-800",
  "GIFTPACK CERVEZAS": "bg-yellow-100 text-yellow-800",
  "SPIRITS ADYACENCIAS": "bg-purple-100 text-purple-800",
  "SIDRAS": "bg-rose-100 text-rose-800",
  "VINOS": "bg-red-100 text-red-800",
  "TE": "bg-emerald-100 text-emerald-800",
}

const DEFAULT_COLOR = "bg-slate-100 text-slate-700"

export function DivisionBadge({ division }: { division: string }) {
  if (!division) return null
  const color = DIVISION_COLORS[division.toUpperCase()] ?? DEFAULT_COLOR
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${color}`}>
      {division}
    </span>
  )
}
