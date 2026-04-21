"use client"

import { useState, useEffect, useCallback } from "react"
import { getFrescuraData, type FrescuraData, type FrescuraResumen } from "@/actions/frescura"
import { getVpdChess, type VpdData } from "@/actions/vpd-chess"
import { getPrecios } from "@/actions/precios"
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
import { DateRangePicker } from "@/components/date-range-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type SemaforoPiso = "verde" | "amarillo" | "rojo" | "sin-datos"

function calcSemaforo(diasDePiso: number | null, diasRestantes: number): SemaforoPiso {
  if (diasDePiso === null) return "sin-datos"
  if (diasRestantes <= 0) return "rojo"
  if (diasDePiso > diasRestantes) return "rojo"
  if (diasDePiso > diasRestantes * 0.7) return "amarillo"
  return "verde"
}

export function FrescuraClient() {
  const [data, setData] = useState<FrescuraData | null>(null)
  const [vpdData, setVpdData] = useState<VpdData | null>(null)
  const [precios, setPrecios] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [vpdLoading, setVpdLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filtro, setFiltro] = useState<"todos" | "3meses" | "vencidos" | "criticos" | "urgentes" | "atencion" | "ok" | "piso-rojo">("3meses")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [deposito, setDeposito] = useState("TODOS")
  const [divFilter, setDivFilter] = useState("TODAS")
  const [showPrecios, setShowPrecios] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const [uploading, setUploading] = useState(false)
  const [selectedSku, setSelectedSku] = useState<FrescuraResumen | null>(null)

  // VPD date range
  const initHasta = new Date().toISOString().split("T")[0]
  const initDesde = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0] })()
  const [vpdDesde, setVpdDesde] = useState(initDesde)
  const [vpdHasta, setVpdHasta] = useState(initHasta)

  const loadData = useCallback(async (dep?: string) => {
    try {
      setError("")
      const result = await getFrescuraData(dep ?? deposito)
      setData(result)
      setLastUpdate(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [deposito])

  const loadVpd = useCallback(async (desde?: string, hasta?: string) => {
    const d = desde ?? vpdDesde
    const h = hasta ?? vpdHasta
    setVpdLoading(true)
    try {
      const result = await getVpdChess(30, d, h)
      setVpdData(result)
    } catch {
      // VPD is optional
    } finally {
      setVpdLoading(false)
    }
  }, [vpdDesde, vpdHasta])

  function handleDepositoChange(dep: string) {
    setDeposito(dep)
    setLoading(true)
    loadData(dep)
  }

  function handleVpdRangeChange(desde: string, hasta: string) {
    setVpdDesde(desde)
    setVpdHasta(hasta)
    loadVpd(desde, hasta)
  }

  const loadPreciosData = useCallback(async () => {
    try {
      const p = await getPrecios()
      setPrecios(p)
    } catch { /* optional */ }
  }, [])

  useEffect(() => {
    loadData()
    loadVpd()
    loadPreciosData()
  }, [loadData, loadVpd, loadPreciosData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => { loadData(); loadVpd() }, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadData, loadVpd])

  // VPD helpers
  function getVpd(articulo: string): number | null {
    if (!vpdData?.vpd) return null
    const item = vpdData.vpd[articulo]
    return item ? item.vpdBultos : null
  }

  function getDiasDePiso(r: FrescuraResumen): number | null {
    const vpd = getVpd(r.articulo)
    if (vpd === null || vpd <= 0) return null
    return Math.round((r.bultosTotal / vpd) * 10) / 10
  }

  // Precio helpers
  function getValorizado(r: FrescuraResumen): number | null {
    const p = precios[r.articulo]
    if (!p || p <= 0) return null
    return r.bultosTotal * p
  }

  function getPrecioUnit(articulo: string): number | null {
    const p = precios[articulo]
    return p && p > 0 ? p : null
  }

  const divisiones = [...new Set((data?.resumen || []).map((r) => r.division).filter(Boolean))].sort()

  const filtered = (data?.resumen || []).filter((r) => {
    if (divFilter !== "TODAS" && r.division !== divFilter) return false
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
    else if (filtro === "piso-rojo") {
      const dp = getDiasDePiso(r)
      matchFiltro = calcSemaforo(dp, r.diasRestantes) === "rojo"
    }
    return matchSearch && matchFiltro
  })

  const pisoRojoCount = (data?.resumen || []).filter((r) => {
    const dp = getDiasDePiso(r)
    return calcSemaforo(dp, r.diasRestantes) === "rojo"
  }).length

  // Totales valorizados
  const preciosSKUs = Object.keys(precios).length
  const valorizadoFiltered = filtered.reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoVencidos = (data?.resumen || []).filter(r => r.diasRestantes < 0).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoCriticos = (data?.resumen || []).filter(r => r.diasRestantes >= 0 && r.diasRestantes <= 15).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoUrgentes = (data?.resumen || []).filter(r => r.diasRestantes > 15 && r.diasRestantes <= 30).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)

  async function handleUploadPrecios(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/precios", { method: "POST", body: fd })
      const json = await res.json()
      if (json.ok) {
        setUploadMsg(`OK: ${json.actualizados} precios actualizados (${json.total} total)`)
        await loadPreciosData()
      } else {
        setUploadMsg(`Error: ${json.error}`)
      }
    } catch (err) {
      setUploadMsg(`Error: ${String(err)}`)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-[1800px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Frescura</h1>
            <Badge variant="outline" className="text-xs">Vencimientos + Piso</Badge>
            {vpdLoading && <span className="text-xs text-blue-500 animate-pulse">Cargando VPD...</span>}
            {vpdData && !vpdLoading && (
              <span className="text-xs text-slate-400">VPD {vpdData.diasRango}d</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={deposito}
              onChange={(e) => handleDepositoChange(e.target.value)}
              className="px-2 py-1 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
            >
              <option value="TODOS">Todos los almacenes</option>
              {data?.depositosDisponibles?.map((d) => (
                <option key={d} value={d}>Almacen {d}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-white shadow-sm">
              <label className="text-xs text-slate-500">Auto:</label>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-blue-600" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPrecios(!showPrecios)} className={showPrecios ? "border-purple-400 text-purple-700" : ""}>
              {preciosSKUs > 0 ? `$ Precios (${preciosSKUs})` : "$ Precios"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { loadData(); loadVpd() }} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
            </Button>
            {lastUpdate && (
              <span className="text-xs text-slate-400">{lastUpdate.toLocaleTimeString("es-AR")}</span>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1800px] px-4 pt-2 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">VPD rango:</span>
            <DateRangePicker desde={vpdDesde} hasta={vpdHasta} onChange={handleVpdRangeChange} loading={vpdLoading} />
          </div>
        </div>
        {showPrecios && (
          <div className="mx-auto max-w-[1800px] px-4 py-2 border-t border-slate-100">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-xs text-slate-500 font-medium">Subir Excel de precios:</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUploadPrecios}
                disabled={uploading}
                className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
              />
              {uploading && <span className="text-xs text-purple-500 animate-pulse">Procesando...</span>}
              {uploadMsg && (
                <span className={`text-xs ${uploadMsg.startsWith("OK") ? "text-emerald-600" : "text-red-600"}`}>{uploadMsg}</span>
              )}
              {preciosSKUs > 0 && (
                <span className="text-xs text-slate-400">{preciosSKUs} SKUs con precio cargado</span>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {vpdData?.error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">VPD Chess: {vpdData.error}</p>
          </div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <FiltroCard label="Todos" value={data.totales.productos} active={filtro === "todos"} onClick={() => setFiltro("todos")} color="border-slate-300" bgColor="bg-white" textColor="text-slate-800" />
              <FiltroCard label="Prox. 3 meses" value={data.totales.tresMeses} active={filtro === "3meses"} onClick={() => setFiltro("3meses")} color="border-blue-400" bgColor="bg-blue-50" textColor="text-blue-700" />
              <FiltroCard label="Vencidos" value={data.totales.vencidos} active={filtro === "vencidos"} onClick={() => setFiltro("vencidos")} color="border-red-400" bgColor="bg-red-50" textColor="text-red-700" />
              <FiltroCard label="Criticos (0-15d)" value={data.totales.criticos} active={filtro === "criticos"} onClick={() => setFiltro("criticos")} color="border-red-300" bgColor="bg-red-50" textColor="text-red-600" />
              <FiltroCard label="Urgentes (16-30d)" value={data.totales.urgentes} active={filtro === "urgentes"} onClick={() => setFiltro("urgentes")} color="border-amber-400" bgColor="bg-amber-50" textColor="text-amber-700" />
              <FiltroCard label="Atencion (31-60d)" value={data.totales.atencion} active={filtro === "atencion"} onClick={() => setFiltro("atencion")} color="border-amber-300" bgColor="bg-amber-50" textColor="text-amber-600" />
              <FiltroCard label="OK (+60d)" value={data.totales.ok} active={filtro === "ok"} onClick={() => setFiltro("ok")} color="border-emerald-400" bgColor="bg-emerald-50" textColor="text-emerald-700" />
              <FiltroCard
                label="Piso Rojo"
                value={pisoRojoCount}
                active={filtro === "piso-rojo"}
                onClick={() => setFiltro("piso-rojo")}
                color="border-red-500"
                bgColor="bg-red-50"
                textColor="text-red-700"
                subtitle="no llegan"
              />
            </div>

            {/* Valorizado KPIs */}
            {preciosSKUs > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-purple-500">Valorizado (filtro actual)</p>
                    <p className="text-xl font-bold text-purple-700">{fmtMoney(valorizadoFiltered)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-red-500">Vencidos</p>
                    <p className="text-xl font-bold text-red-700">{fmtMoney(valorizadoVencidos)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/30">
                  <CardContent className="p-3">
                    <p className="text-xs text-red-400">Criticos (0-15d)</p>
                    <p className="text-xl font-bold text-red-600">{fmtMoney(valorizadoCriticos)}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-amber-500">Urgentes (16-30d)</p>
                    <p className="text-xl font-bold text-amber-700">{fmtMoney(valorizadoUrgentes)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Search + Division Filter */}
            <div className="flex items-center gap-3">
              <Input placeholder="Buscar articulo o descripcion..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm bg-white" />
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
              <span className="text-sm text-slate-400">{filtered.length} de {data.resumen.length} productos</span>
            </div>

            {/* Leyenda semaforo */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Piso OK</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" /> Piso justo</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> No llega</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300" /> Sin datos VPD</span>
            </div>

            {/* Compact table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="w-8 text-center">Piso</TableHead>
                      <TableHead className="w-24">Estado</TableHead>
                      <TableHead>Articulo</TableHead>
                      <TableHead className="max-w-[280px]">Descripcion</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead className="text-right">Bultos</TableHead>
                      {preciosSKUs > 0 && <TableHead className="text-right">Valorizado</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => {
                      const diasPiso = getDiasDePiso(r)
                      const semaforo = calcSemaforo(diasPiso, r.diasRestantes)
                      const val = getValorizado(r)

                      return (
                        <TableRow
                          key={`${r.articulo}-${i}`}
                          className={`${rowBg(r.diasRestantes)} cursor-pointer hover:bg-blue-50/60 transition-colors`}
                          onClick={() => setSelectedSku(r)}
                        >
                          <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                          <TableCell className="text-center">
                            <SemaforoDot semaforo={semaforo} />
                          </TableCell>
                          <TableCell><StatusBadge dias={r.diasRestantes} /></TableCell>
                          <TableCell className="font-mono text-sm text-slate-800 font-medium">{r.articulo}</TableCell>
                          <TableCell className="text-sm max-w-[280px] truncate text-slate-600">{r.descripcion}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold text-lg ${diasColor(r.diasRestantes)}`}>{r.diasRestantes}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm text-slate-700 tabular-nums">{fmtNum(r.bultosTotal)}</TableCell>
                          {preciosSKUs > 0 && (
                            <TableCell className="text-right text-sm tabular-nums">
                              {val !== null ? (
                                <span className="text-purple-700 font-semibold">{fmtMoney(val)}</span>
                              ) : (
                                <span className="text-slate-300">--</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={preciosSKUs > 0 ? 8 : 7} className="text-center py-8 text-slate-400">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>

      {/* ── Detail Modal ── */}
      <Dialog open={selectedSku !== null} onOpenChange={(open) => { if (!open) setSelectedSku(null) }}>
        {selectedSku && (
          <SkuDetailModal
            r={selectedSku}
            vpd={getVpd(selectedSku.articulo)}
            diasPiso={getDiasDePiso(selectedSku)}
            precioUnit={getPrecioUnit(selectedSku.articulo)}
            valorizado={getValorizado(selectedSku)}
          />
        )}
      </Dialog>
    </div>
  )
}

// ── SKU Detail Modal ────────────────────────────────────────────────

function SkuDetailModal({ r, vpd, diasPiso, precioUnit, valorizado }: {
  r: FrescuraResumen
  vpd: number | null
  diasPiso: number | null
  precioUnit: number | null
  valorizado: number | null
}) {
  const semaforo = calcSemaforo(diasPiso, r.diasRestantes)

  // Bultos/unidades del vencimiento más próximo (lo que está en riesgo)
  const bultosProx = r.bultosProxVenc ?? r.bultosTotal
  const unidadesProx = r.unidadesProxVenc ?? r.unidadesTotal
  const valorizadoProx = precioUnit !== null ? bultosProx * precioUnit : null

  return (
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-lg">
          <span className="font-mono">{r.articulo}</span>
          <StatusBadge dias={r.diasRestantes} />
          <SemaforoDot semaforo={semaforo} />
        </DialogTitle>
        <DialogDescription className="text-base text-slate-700 font-medium">
          {r.descripcion}
        </DialogDescription>
      </DialogHeader>

      {/* Info chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {r.division && <DivisionBadge division={r.division} />}
        {r.marca && <Badge variant="outline" className="text-xs">{r.marca}</Badge>}
        {r.unidadNegocio && <Badge variant="outline" className="text-xs">{r.unidadNegocio}</Badge>}
        <Badge variant={r.apto === "SI" ? "default" : "destructive"} className="text-xs">
          Apto: {r.apto || "-"}
        </Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi
          label="Dias p/ vencimiento"
          value={String(r.diasRestantes)}
          sub={formatDate(r.vencimientoProximo)}
          color={diasColor(r.diasRestantes)}
        />
        <MiniKpi
          label="Bultos próx. venc."
          value={fmtNum(bultosProx)}
          sub={`${fmtNum(unidadesProx)} unid. — Total: ${fmtNum(r.bultosTotal)} blt`}
        />
        <MiniKpi
          label="VPD"
          value={vpd !== null ? `${vpd.toFixed(1)} blt/dia` : "Sin datos"}
          sub={diasPiso !== null ? `Piso: ${diasPiso.toFixed(0)} dias` : ""}
          color={vpd !== null ? "text-blue-600" : "text-slate-400"}
        />
        <MiniKpi
          label="Dias en deposito"
          value={r.diasEnDeposito > 0 ? String(r.diasEnDeposito) : "-"}
          sub={r.fechaIngreso ? `Ingreso: ${formatDate(r.fechaIngreso)}` : ""}
        />
      </div>

      {/* Valorizado section */}
      {precioUnit !== null && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-500 font-medium">Valorizado en riesgo</p>
              <p className="text-2xl font-bold text-purple-700">{valorizadoProx !== null ? fmtMoney(valorizadoProx) : "-"}</p>
              {valorizado !== null && valorizado !== valorizadoProx && (
                <p className="text-xs text-purple-400 mt-0.5">Total stock: {fmtMoney(valorizado)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-400">Precio por bulto</p>
              <p className="text-lg font-semibold text-purple-600">{fmtMoney(precioUnit)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-400">Bultos próx. venc.</p>
              <p className="text-lg font-semibold text-slate-700">{fmtNum(bultosProx)}</p>
            </div>
          </div>
          {semaforo === "rojo" && (
            <p className="text-sm text-red-600 font-bold mt-2">NO LLEGA A VENDER - Perdida potencial: {valorizadoProx !== null ? fmtMoney(valorizadoProx) : "-"}</p>
          )}
        </div>
      )}

      {precioUnit === null && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-sm text-slate-400">Sin precio cargado para este SKU</p>
        </div>
      )}

      {/* Lotes */}
      <div className="text-xs text-slate-500">
        {r.lotes} lote{r.lotes !== 1 ? "s" : ""}
      </div>

      {/* Contenedores table */}
      <div className="border rounded-lg overflow-hidden">
        <ScrollArea>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Contenedor</TableHead>
                <TableHead className="text-xs">Lote</TableHead>
                <TableHead className="text-xs text-center">Vencimiento</TableHead>
                <TableHead className="text-xs text-center">Dias</TableHead>
                <TableHead className="text-xs text-right">Bultos</TableHead>
                <TableHead className="text-xs text-right">Unidades</TableHead>
                {precioUnit !== null && <TableHead className="text-xs text-right">Valorizado</TableHead>}
                <TableHead className="text-xs text-center">Ingreso</TableHead>
                <TableHead className="text-xs text-center">Dias Dep.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.contenedores.map((c, j) => (
                <TableRow key={j} className={rowBg(c.diasRestantes)}>
                  <TableCell className="text-xs font-mono py-1.5">{c.contenedor}</TableCell>
                  <TableCell className="text-xs font-mono py-1.5">{c.lote}</TableCell>
                  <TableCell className="text-xs text-center font-mono py-1.5">{formatDate(c.vencimiento)}</TableCell>
                  <TableCell className="text-center py-1.5">
                    <span className={`text-xs font-bold ${diasColor(c.diasRestantes)}`}>{c.diasRestantes}</span>
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold py-1.5">{fmtNum(c.bultos)}</TableCell>
                  <TableCell className="text-xs text-right text-slate-400 py-1.5">{fmtNum(c.unidades)}</TableCell>
                  {precioUnit !== null && (
                    <TableCell className="text-xs text-right text-purple-700 font-semibold py-1.5">
                      {fmtMoney(c.bultos * precioUnit)}
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-center font-mono py-1.5">{formatDate(c.fechaIngreso)}</TableCell>
                  <TableCell className="text-xs text-center py-1.5">{c.diasEnDeposito > 0 ? c.diasEnDeposito : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </DialogContent>
  )
}

// ── Components ────────────────────────────────────────────────────

function MiniKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color || "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function FiltroCard({ label, value, active, onClick, color, bgColor, textColor, subtitle }: {
  label: string; value: number; active: boolean; onClick: () => void
  color: string; bgColor?: string; textColor?: string; subtitle?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] shadow-sm ${
        active ? `${color} ${bgColor || "bg-white"}` : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${active && textColor ? textColor : "text-slate-800"}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
    </button>
  )
}

function SemaforoDot({ semaforo }: { semaforo: SemaforoPiso }) {
  const colors = {
    verde: "bg-emerald-500",
    amarillo: "bg-amber-400",
    rojo: "bg-red-500 animate-pulse",
    "sin-datos": "bg-slate-300",
  }
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[semaforo]}`} title={
      semaforo === "verde" ? "Piso OK"
      : semaforo === "amarillo" ? "Piso justo"
      : semaforo === "rojo" ? "No llega a vender"
      : "Sin datos VPD"
    } />
  )
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge className="bg-red-100 text-red-700 text-xs border-0">VENCIDO</Badge>
  if (dias <= 15) return <Badge className="bg-red-100 text-red-600 text-xs border-0">CRITICO</Badge>
  if (dias <= 30) return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">URGENTE</Badge>
  if (dias <= 60) return <Badge className="bg-amber-50 text-amber-600 text-xs border-0">ATENCION</Badge>
  return <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">OK</Badge>
}

// ── Helpers ───────────────────────────────────────────────────────

function diasColor(dias: number): string {
  if (dias < 0) return "text-red-700"
  if (dias <= 15) return "text-red-600"
  if (dias <= 30) return "text-amber-600"
  if (dias <= 60) return "text-amber-500"
  return "text-emerald-600"
}

function rowBg(dias: number): string {
  if (dias < 0) return "bg-red-50"
  if (dias <= 15) return "bg-red-50/50"
  if (dias <= 30) return "bg-amber-50/50"
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

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `$${Math.round(n).toLocaleString("es-AR")}`
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}
