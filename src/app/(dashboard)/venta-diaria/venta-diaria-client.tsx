"use client"

import { useState, useEffect, useCallback } from "react"
import { getVentaDiariaData, type VentaDiariaData } from "@/actions/venta-diaria"
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

type SortKey = "promedioDiario" | "ventaNeta" | "totalBultos" | "totalRechazos" | "diasConVenta" | "frecuencia" | "dsArticulo"
type SortDir = "asc" | "desc"

const PERIODOS = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
]

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(0) + "%"
}

function fmtDate(d: string): string {
  if (!d) return "-"
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}

export function VentaDiariaClient() {
  const [data, setData] = useState<VentaDiariaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [periodo, setPeriodo] = useState(30)
  const [sortKey, setSortKey] = useState<SortKey>("promedioDiario")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [divFilter, setDivFilter] = useState("TODAS")

  const loadData = useCallback(async (dias: number) => {
    try {
      setLoading(true)
      setError("")
      const result = await getVentaDiariaData(dias)
      if (result.error) {
        setError(result.error)
      } else {
        setData(result)
      }
      setLastUpdate(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData(periodo) }, [loadData, periodo])

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
    const na = Number(va)
    const nb = Number(vb)
    return sortDir === "asc" ? na - nb : nb - na
  })

  // KPI totals
  const totalVentaNeta = filtered.reduce((s, r) => s + r.ventaNeta, 0)
  const totalRechazos = filtered.reduce((s, r) => s + r.totalRechazos, 0)
  const totalPromedio = data?.diasRango ? totalVentaNeta / data.diasRango : 0

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-muted-foreground/30 ml-1">↕</span>
    return <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground text-sm">← Explorador</a>
            <h1 className="text-2xl font-bold tracking-tight">Venta Diaria</h1>
            <Badge variant="outline" className="text-xs">Promedio por SKU</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(periodo)}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </Button>
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                {lastUpdate.toLocaleTimeString("es-AR")}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 space-y-4">
        {/* Error */}
        {error && (
          <Card className="border-red-500">
            <CardContent className="py-4 text-red-500 text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Periodo:</span>
          {PERIODOS.map((p) => (
            <Button
              key={p.value}
              variant={periodo === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodo(p.value)}
              disabled={loading}
            >
              {p.label}
            </Button>
          ))}
          {data && (
            <span className="text-xs text-muted-foreground ml-2">
              {fmtDate(data.fechaDesde)} — {fmtDate(data.fechaHasta)} ({data.diasRango} dias)
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-96 rounded-lg" />
          </div>
        )}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">SKUs</p>
                  <p className="text-2xl font-bold">{filtered.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">Venta Neta Total</p>
                  <p className="text-2xl font-bold text-green-500">{fmt(totalVentaNeta, 0)}</p>
                  <p className="text-xs text-muted-foreground">bultos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">Promedio Diario Total</p>
                  <p className="text-2xl font-bold text-blue-500">{fmt(totalPromedio)}</p>
                  <p className="text-xs text-muted-foreground">bultos/dia</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">Rechazos</p>
                  <p className="text-2xl font-bold text-red-500">{fmt(totalRechazos, 0)}</p>
                  <p className="text-xs text-muted-foreground">bultos</p>
                </CardContent>
              </Card>
            </div>

            {/* Search + Division filter + count */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Buscar articulo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <select
                value={divFilter}
                onChange={(e) => setDivFilter(e.target.value)}
                className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="TODAS">Todas las divisiones</option>
                {divisiones.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {sorted.length} articulos | {data.totalRegistros} lineas de venta
              </span>
              {loading && <span className="text-xs text-yellow-500">Actualizando...</span>}
            </div>

            {/* Main table */}
            <ScrollArea className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-20">
                      <button onClick={() => handleSort("dsArticulo")} className="flex items-center hover:text-foreground">
                        Articulo<SortIcon col="dsArticulo" />
                      </button>
                    </TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead>División</TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("totalBultos")} className="flex items-center justify-end hover:text-foreground w-full">
                        Total Bultos<SortIcon col="totalBultos" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("totalRechazos")} className="flex items-center justify-end hover:text-foreground w-full">
                        Rechazos<SortIcon col="totalRechazos" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("ventaNeta")} className="flex items-center justify-end hover:text-foreground w-full">
                        Venta Neta<SortIcon col="ventaNeta" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("promedioDiario")} className="flex items-center justify-end hover:text-foreground w-full">
                        Prom. Diario<SortIcon col="promedioDiario" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("diasConVenta")} className="flex items-center justify-end hover:text-foreground w-full">
                        Dias c/Venta<SortIcon col="diasConVenta" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button onClick={() => handleSort("frecuencia")} className="flex items-center justify-end hover:text-foreground w-full">
                        Frecuencia<SortIcon col="frecuencia" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {loading ? "Cargando datos de Chess ERP..." : "Sin resultados"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((sku, idx) => (
                      <TableRow key={sku.idArticulo} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{sku.idArticulo}</TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">{sku.dsArticulo}</TableCell>
                        <TableCell><DivisionBadge division={sku.division} /></TableCell>
                        <TableCell className="text-right font-medium">{fmt(sku.totalBultos, 0)}</TableCell>
                        <TableCell className="text-right text-red-500">{sku.totalRechazos > 0 ? fmt(sku.totalRechazos, 0) : "-"}</TableCell>
                        <TableCell className="text-right font-medium text-green-500">{fmt(sku.ventaNeta, 0)}</TableCell>
                        <TableCell className="text-right font-bold text-blue-500">{fmt(sku.promedioDiario)}</TableCell>
                        <TableCell className="text-right">{sku.diasConVenta}</TableCell>
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
          </>
        )}
      </main>
    </div>
  )
}

function FrecuenciaBadge({ frecuencia }: { frecuencia: number }) {
  const pct = (frecuencia * 100).toFixed(0) + "%"
  if (frecuencia >= 0.7) return <Badge className="bg-green-600 text-white text-xs">{pct}</Badge>
  if (frecuencia >= 0.4) return <Badge className="bg-yellow-600 text-white text-xs">{pct}</Badge>
  return <Badge variant="outline" className="text-xs">{pct}</Badge>
}
