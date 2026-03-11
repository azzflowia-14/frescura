"use client"

import { useState, useEffect, useCallback } from "react"
import { getFrescuraData, type FrescuraData, type FrescuraResumen } from "@/actions/frescura"
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

export function FrescuraClient() {
  const [data, setData] = useState<FrescuraData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filtro, setFiltro] = useState<"todos" | "3meses" | "vencidos" | "criticos" | "urgentes" | "atencion" | "ok">("3meses")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError("")
      const result = await getFrescuraData()
      setData(result)
      setLastUpdate(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadData])

  const filtered = (data?.resumen || []).filter((r) => {
    const matchSearch =
      !search ||
      r.articulo.toLowerCase().includes(search.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(search.toLowerCase())

    let matchFiltro = true
    if (filtro === "3meses") matchFiltro = r.diasRestantes <= 90
    else if (filtro === "vencidos") matchFiltro = r.diasRestantes < 0
    else if (filtro === "criticos") matchFiltro = r.diasRestantes >= 0 && r.diasRestantes <= 15
    else if (filtro === "urgentes") matchFiltro = r.diasRestantes > 15 && r.diasRestantes <= 30
    else if (filtro === "atencion") matchFiltro = r.diasRestantes > 30 && r.diasRestantes <= 60
    else if (filtro === "ok") matchFiltro = r.diasRestantes > 60

    return matchSearch && matchFiltro
  })

  function toggleExpand(articulo: string) {
    setExpanded(expanded === articulo ? null : articulo)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground text-sm">← Explorador</a>
            <h1 className="text-2xl font-bold tracking-tight">Frescura</h1>
            <Badge variant="outline" className="text-xs">Vencimientos</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border rounded-md px-2 py-1">
              <label className="text-xs text-muted-foreground">Auto-refresh:</label>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-primary" />
              {autoRefresh && <span className="text-xs text-muted-foreground">60s</span>}
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
            </Button>
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">{lastUpdate.toLocaleTimeString("es-AR")}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {error && (
          <Card className="border-red-800">
            <CardContent className="py-4 text-red-600">{error}</CardContent>
          </Card>
        )}

        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard label="Todos" value={data.totales.productos} active={filtro === "todos"} onClick={() => setFiltro("todos")} color="border-gray-400" bgColor="bg-gray-50" textColor="text-gray-900" />
              <KpiCard label="Próx. 3 meses" value={data.totales.tresMeses} active={filtro === "3meses"} onClick={() => setFiltro("3meses")} color="border-blue-500" bgColor="bg-blue-50" textColor="text-blue-700" />
              <KpiCard label="Vencidos" value={data.totales.vencidos} active={filtro === "vencidos"} onClick={() => setFiltro("vencidos")} color="border-red-500" bgColor="bg-red-50" textColor="text-red-700" />
              <KpiCard label="Críticos (0-15d)" value={data.totales.criticos} active={filtro === "criticos"} onClick={() => setFiltro("criticos")} color="border-red-400" bgColor="bg-red-50" textColor="text-red-600" />
              <KpiCard label="Urgentes (16-30d)" value={data.totales.urgentes} active={filtro === "urgentes"} onClick={() => setFiltro("urgentes")} color="border-yellow-500" bgColor="bg-yellow-50" textColor="text-yellow-700" />
              <KpiCard label="Atención (31-60d)" value={data.totales.atencion} active={filtro === "atencion"} onClick={() => setFiltro("atencion")} color="border-yellow-400" bgColor="bg-yellow-50" textColor="text-yellow-600" />
              <KpiCard label="OK (+60d)" value={data.totales.ok} active={filtro === "ok"} onClick={() => setFiltro("ok")} color="border-green-500" bgColor="bg-green-50" textColor="text-green-700" />
            </div>

            {/* Debug info */}
            {data.debug && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 font-mono">
                {data.debug}
              </div>
            )}

            {/* Search */}
            <div className="flex items-center gap-3">
              <Input placeholder="Buscar artículo o descripción..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
              <span className="text-sm text-muted-foreground">{filtered.length} de {data.resumen.length} productos</span>
            </div>

            {/* Main table */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="w-24">Estado</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-center">Días</TableHead>
                          <TableHead className="text-center">Vencimiento</TableHead>
                          <TableHead className="text-right">Bultos Prox.</TableHead>
                          <TableHead className="text-right">Unid. Prox.</TableHead>
                          <TableHead className="text-right">Bultos Total</TableHead>
                          <TableHead className="text-right">Unid. Total</TableHead>
                          <TableHead className="text-center">Ud/Bulto</TableHead>
                          <TableHead className="text-center">Ingreso</TableHead>
                          <TableHead className="text-center">Días Dep.</TableHead>
                          <TableHead className="text-center">Lotes</TableHead>
                          <TableHead className="text-center">Apto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r, i) => {
                          const isExpanded = expanded === r.articulo
                          return (
                            <>
                              <TableRow
                                key={`row-${r.articulo}-${i}`}
                                className={`${rowBg(r.diasRestantes)} cursor-pointer hover:bg-accent/50 transition-colors`}
                                onClick={() => toggleExpand(r.articulo)}
                              >
                                <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                                <TableCell><StatusBadge dias={r.diasRestantes} /></TableCell>
                                <TableCell className="font-mono text-sm">
                                  <span className="mr-1 text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                                  {r.articulo}
                                </TableCell>
                                <TableCell className="text-sm max-w-[250px] truncate">{r.descripcion}</TableCell>
                                <TableCell className="text-center">
                                  <span className={`font-bold text-lg ${diasColor(r.diasRestantes)}`}>{r.diasRestantes}</span>
                                </TableCell>
                                <TableCell className="text-center text-sm font-mono">{formatDate(r.vencimientoProximo)}</TableCell>
                                <TableCell className="text-right font-semibold text-sm">{fmtNum(r.bultosProxVenc)}</TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{fmtNum(r.unidadesProxVenc)}</TableCell>
                                <TableCell className="text-right font-semibold text-sm">{fmtNum(r.bultosTotal)}</TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{fmtNum(r.unidadesTotal)}</TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">{r.unidadesPorBulto > 1 ? r.unidadesPorBulto : <span className="text-red-400">1?</span>}</TableCell>
                                <TableCell className="text-center text-sm font-mono">{formatDate(r.fechaIngreso)}</TableCell>
                                <TableCell className="text-center text-sm font-semibold">{r.diasEnDeposito > 0 ? r.diasEnDeposito : "-"}</TableCell>
                                <TableCell className="text-center text-sm">{r.lotes}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={r.apto === "SI" ? "default" : "destructive"} className="text-xs">{r.apto || "-"}</Badge>
                                </TableCell>
                              </TableRow>

                              {/* Expanded: contenedores detail */}
                              {isExpanded && (
                                <TableRow key={`detail-${r.articulo}`} className="bg-gray-50">
                                  <TableCell colSpan={15} className="p-0">
                                    <div className="px-8 py-3 border-y border-border/50">
                                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                                        Detalle de contenedores — {r.articulo} {r.descripcion}
                                      </p>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">Contenedor</TableHead>
                                            <TableHead className="text-xs">Lote</TableHead>
                                            <TableHead className="text-xs text-center">Vencimiento</TableHead>
                                            <TableHead className="text-xs text-center">Días</TableHead>
                                            <TableHead className="text-xs text-right">Bultos</TableHead>
                                            <TableHead className="text-xs text-right">Unidades</TableHead>
                                            <TableHead className="text-xs text-center">Ingreso</TableHead>
                                            <TableHead className="text-xs text-center">Días Dep.</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {r.contenedores.map((c, j) => (
                                            <TableRow key={j} className={rowBg(c.diasRestantes)}>
                                              <TableCell className="text-xs font-mono py-1">{c.contenedor}</TableCell>
                                              <TableCell className="text-xs font-mono py-1">{c.lote}</TableCell>
                                              <TableCell className="text-xs text-center font-mono py-1">{formatDate(c.vencimiento)}</TableCell>
                                              <TableCell className="text-center py-1">
                                                <span className={`text-xs font-bold ${diasColor(c.diasRestantes)}`}>{c.diasRestantes}</span>
                                              </TableCell>
                                              <TableCell className="text-xs text-right font-semibold py-1">{fmtNum(c.bultos)}</TableCell>
                                              <TableCell className="text-xs text-right text-muted-foreground py-1">{fmtNum(c.unidades)}</TableCell>
                                              <TableCell className="text-xs text-center font-mono py-1">{formatDate(c.fechaIngreso)}</TableCell>
                                              <TableCell className="text-xs text-center py-1">{c.diasEnDeposito > 0 ? c.diasEnDeposito : "-"}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          )
                        })}
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                              No se encontraron productos
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────

function KpiCard({ label, value, active, onClick, color, bgColor, textColor }: {
  label: string; value: number; active: boolean; onClick: () => void
  color: string; bgColor?: string; textColor?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 p-4 text-left transition-all hover:scale-[1.02] ${
        active ? `${color} ${bgColor || ""}` : "border-border hover:border-zinc-500"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${active && textColor ? textColor : ""}`}>{value}</p>
    </button>
  )
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge className="bg-red-600 text-white text-xs">VENCIDO</Badge>
  if (dias <= 15) return <Badge className="bg-red-500 text-white text-xs">CRÍTICO</Badge>
  if (dias <= 30) return <Badge className="bg-yellow-400 text-black text-xs">URGENTE</Badge>
  if (dias <= 60) return <Badge className="bg-yellow-300 text-black text-xs">ATENCIÓN</Badge>
  return <Badge className="bg-green-500 text-white text-xs">OK</Badge>
}

// ── Helpers ───────────────────────────────────────────────────────

function diasColor(dias: number): string {
  if (dias < 0) return "text-red-700"
  if (dias <= 15) return "text-red-600"
  if (dias <= 30) return "text-yellow-600"
  if (dias <= 60) return "text-yellow-500"
  return "text-green-600"
}

function rowBg(dias: number): string {
  if (dias < 0) return "bg-red-100"
  if (dias <= 15) return "bg-red-50"
  if (dias <= 30) return "bg-yellow-50"
  return ""
}

function formatDate(iso: string): string {
  if (!iso) return "-"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
}
