"use client"

import { useState, useCallback } from "react"
import { getVentaDiariaData, type VentaDiariaData, type SkuVentaDiaria } from "@/actions/venta-diaria"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { DivisionBadge } from "@/components/division-badge"

const PERIODOS = [
  { label: "7 dias", value: 7, color: "bg-blue-500" },
  { label: "15 dias", value: 15, color: "bg-indigo-500" },
  { label: "30 dias", value: 30, color: "bg-purple-500" },
]

type SortKey = "promedioDiario" | "ventaNeta" | "totalBultos" | "dsArticulo" | "frecuencia"
type SortDir = "asc" | "desc"

export function VpdClient() {
  const [data, setData] = useState<VentaDiariaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [periodo, setPeriodo] = useState(30)
  const [search, setSearch] = useState("")
  const [divFilter, setDivFilter] = useState("TODAS")
  const [sortKey, setSortKey] = useState<SortKey>("promedioDiario")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [downloading, setDownloading] = useState(false)

  const loadData = useCallback(async (dias: number) => {
    setLoading(true)
    setError("")
    try {
      const result = await getVentaDiariaData(dias)
      if (result.error) setError(result.error)
      else setData(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  function handlePeriodo(dias: number) {
    setPeriodo(dias)
    loadData(dias)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc")
    } else {
      setSortKey(key)
      setSortDir(key === "dsArticulo" ? "asc" : "desc")
    }
  }

  const divisiones = [...new Set((data?.skus || []).map((s) => s.division).filter(Boolean))].sort()

  const filtered = (data?.skus || []).filter((s) => {
    if (divFilter !== "TODAS" && s.division !== divFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return s.idArticulo.toLowerCase().includes(q) || s.dsArticulo.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    if (typeof va === "string" && typeof vb === "string") {
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va)
  })

  // KPIs
  const totalSkus = filtered.length
  const totalVentaNeta = filtered.reduce((s, r) => s + r.ventaNeta, 0)
  const totalPromedio = data?.diasRango ? totalVentaNeta / data.diasRango : 0
  const conVenta = filtered.filter((s) => s.ventaNeta > 0).length
  const sinVenta = filtered.filter((s) => s.ventaNeta <= 0).length

  // ── Download Excel ──
  async function downloadExcel() {
    if (!data || sorted.length === 0) return
    setDownloading(true)
    try {
      // Dynamic import xlsx only when needed
      const XLSX = await import("xlsx")

      const rows = sorted.map((s) => ({
        "Cod SKU": s.idArticulo,
        "Descripcion": s.dsArticulo,
        "Division": s.division || "",
        "Marca": s.marca || "",
        [`VPD ${periodo}d (bultos/dia)`]: round2(s.promedioDiario),
        "Venta Neta (bultos)": s.ventaNeta,
        "Total Bultos": s.totalBultos,
        "Rechazos": s.totalRechazos,
        "Dias c/Venta": s.diasConVenta,
        "Frecuencia %": Math.round(s.frecuencia * 100),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)

      // Ancho de columnas
      ws["!cols"] = [
        { wch: 10 }, // Cod SKU
        { wch: 40 }, // Descripcion
        { wch: 15 }, // Division
        { wch: 15 }, // Marca
        { wch: 20 }, // VPD
        { wch: 18 }, // Venta Neta
        { wch: 14 }, // Total Bultos
        { wch: 12 }, // Rechazos
        { wch: 14 }, // Dias c/Venta
        { wch: 14 }, // Frecuencia
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `VPD ${periodo} dias`)

      const fileName = `VPD_${periodo}dias_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (e) {
      console.error("Error generando Excel:", e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Venta Promedio Diaria</h1>
            <Badge variant="outline" className="text-xs">VPD por SKU</Badge>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-xs text-slate-400 mr-2">
                {fmtDate(data.fechaDesde)} — {fmtDate(data.fechaHasta)} ({data.diasRango}d)
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Period selector - big buttons */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-500 font-medium">Selecciona el periodo de analisis</p>
          <div className="flex gap-4">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodo(p.value)}
                disabled={loading}
                className={`relative rounded-2xl px-8 py-5 text-center transition-all hover:scale-105 shadow-lg disabled:opacity-50 ${
                  periodo === p.value && data
                    ? `${p.color} text-white ring-4 ring-offset-2 ring-blue-300`
                    : "bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-300"
                }`}
              >
                <p className="text-3xl font-bold">{p.value}</p>
                <p className="text-sm mt-1 opacity-80">dias</p>
                {loading && periodo === p.value && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/10">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="SKUs" value={String(totalSkus)} color="text-slate-800" />
              <KpiCard label="VPD Total" value={fmt(totalPromedio)} sub="bultos/dia" color="text-blue-600" />
              <KpiCard label="Venta Neta" value={fmt(totalVentaNeta, 0)} sub="bultos" color="text-emerald-600" />
              <KpiCard label="Con Venta" value={String(conVenta)} sub="SKUs" color="text-emerald-500" />
              <KpiCard label="Sin Venta" value={String(sinVenta)} sub="SKUs" color="text-red-500" />
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Buscar por codigo o descripcion..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm bg-white"
              />
              <select
                value={divFilter}
                onChange={(e) => setDivFilter(e.target.value)}
                className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
              >
                <option value="TODAS">Todas las divisiones</option>
                {divisiones.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-sm text-slate-400">{sorted.length} articulos</span>

              <div className="ml-auto">
                <Button
                  onClick={downloadExcel}
                  disabled={downloading || sorted.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Descargar Excel
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loading && <div className="text-center py-2"><span className="text-xs text-blue-500 animate-pulse">Actualizando datos de Chess...</span></div>}

            {/* Table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <ScrollArea>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="w-24">
                          <SortButton label="Codigo" sortKey="dsArticulo" current={sortKey} dir={sortDir} onClick={handleSort} />
                        </TableHead>
                        <TableHead className="min-w-[200px]">Descripcion</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead className="text-right">
                          <SortButton label={`VPD ${periodo}d`} sortKey="promedioDiario" current={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortButton label="Venta Neta" sortKey="ventaNeta" current={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortButton label="Total Blt" sortKey="totalBultos" current={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortButton label="Frecuencia" sortKey="frecuencia" current={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                            {loading ? "Consultando Chess ERP..." : "Sin resultados"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        sorted.map((sku, idx) => (
                          <TableRow key={sku.idArticulo} className="hover:bg-blue-50/40 transition-colors">
                            <TableCell className="text-center text-xs text-slate-400">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-sm text-slate-800 font-medium">{sku.idArticulo}</TableCell>
                            <TableCell className="text-sm text-slate-600 max-w-[300px] truncate">{sku.dsArticulo}</TableCell>
                            <TableCell><DivisionBadge division={sku.division} /></TableCell>
                            <TableCell className="text-right">
                              <span className="text-lg font-bold text-blue-600 tabular-nums">{fmt(sku.promedioDiario)}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600 tabular-nums">{fmt(sku.ventaNeta, 0)}</TableCell>
                            <TableCell className="text-right text-slate-500 tabular-nums">{fmt(sku.totalBultos, 0)}</TableCell>
                            <TableCell className="text-right">
                              <FrecuenciaBadge frecuencia={sku.frecuencia} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

// ── Components ──

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-2xl font-bold ${color || "text-slate-800"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SortButton({ label, sortKey, current, dir, onClick, align }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onClick: (k: SortKey) => void; align?: "right"
}) {
  const isActive = current === sortKey
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 hover:text-slate-800 transition-colors ${align === "right" ? "justify-end w-full" : ""}`}
    >
      {label}
      <span className={isActive ? "text-blue-600" : "text-slate-300"}>
        {isActive ? (dir === "desc" ? "↓" : "↑") : "↕"}
      </span>
    </button>
  )
}

function FrecuenciaBadge({ frecuencia }: { frecuencia: number }) {
  const pct = Math.round(frecuencia * 100) + "%"
  if (frecuencia >= 0.7) return <Badge className="bg-emerald-600 text-white text-xs">{pct}</Badge>
  if (frecuencia >= 0.4) return <Badge className="bg-amber-500 text-white text-xs">{pct}</Badge>
  return <Badge variant="outline" className="text-xs text-slate-400">{pct}</Badge>
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

// ── Helpers ──

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtDate(d: string): string {
  if (!d) return "-"
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}
