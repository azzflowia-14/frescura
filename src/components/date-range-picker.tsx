"use client"

import { useState } from "react"

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "15d", days: 15 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
]

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDate(d)
}

interface DateRangePickerProps {
  desde: string
  hasta: string
  onChange: (desde: string, hasta: string) => void
  loading?: boolean
}

export function DateRangePicker({ desde, hasta, onChange, loading }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<number | null>(30)

  function handlePreset(days: number) {
    setActivePreset(days)
    onChange(daysAgo(days), formatDate(new Date()))
  }

  function handleDesdeChange(value: string) {
    setActivePreset(null)
    onChange(value, hasta)
  }

  function handleHastaChange(value: string) {
    setActivePreset(null)
    onChange(desde, value)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => handlePreset(p.days)}
          disabled={loading}
          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
            activePreset === p.days
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
          } disabled:opacity-50`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date"
          value={desde}
          onChange={(e) => handleDesdeChange(e.target.value)}
          disabled={loading}
          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
        />
        <span className="text-xs text-slate-400">—</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => handleHastaChange(e.target.value)}
          disabled={loading}
          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
        />
      </div>
    </div>
  )
}
