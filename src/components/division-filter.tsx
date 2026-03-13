"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DivisionFilterProps {
  value: string
  onChange: (value: string) => void
  divisiones: string[]
  label?: string
}

export function DivisionFilter({ value, onChange, divisiones, label = "División" }: DivisionFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v) }}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TODAS">Todas</SelectItem>
        {divisiones.map((d) => (
          <SelectItem key={d} value={d}>{d}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
