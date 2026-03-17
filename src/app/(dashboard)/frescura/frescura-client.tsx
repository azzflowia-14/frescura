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

type SemaforoPiso = "verde" | "amarillo" | "rojo" | "sin-datos"

function calcSemaforo(diasDePiso: number | null, diasRestantes: number): SemaforoPiso {
  if (diasDePiso === null) return "sin-datos"
  if (diasRestantes <= 0) return "rojo" // ya vencido
  if (diasDePiso > diasRestantes) return "rojo" // no llegas a vender
  if (diasDePiso > diasRestantes * 0.7) return "amarillo" // vas justo
  return "verde" // tenés margen
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
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deposito, setDeposito] = useState("TODOS")
  const [divFilter, setDivFilter] = useState("TODAS")
  const [showPrecios, setShowPrecios] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const [uploading, setUploading] = useState(false)

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
      // VPD is optional, don't block the page
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

  const loadPrecios = useCallback(async () => {
    try {
      const p = await getPrecios()
      setPrecios(p)
    } catch { /* optional */ }
  }, [])

  useEffect(() => {
    loadData()
    loadVpd()
    loadPrecios()
  }, [loadData, loadVpd, loadPrecios])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => { loadData(); loadVpd() }, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadData, loadVpd])

  // Enriquecer resumen con VPD
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

  // Contar semáforos rojos
  const pisoRojoCount = (data?.resumen || []).filter((r) => {
    const dp = getDiasDePiso(r)
    return calcSemaforo(dp, r.diasRestantes) === "rojo"
  }).length

  function getValorizado(r: FrescuraResumen): number | null {
    const p = precios[r.articulo]
    if (!p || p <= 0) return null
    return r.bultosTotal * p
  }

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
        await loadPrecios()
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

  // Totales valorizados
  const preciosSKUs = Object.keys(precios).length
  const valorizadoFiltered = filtered.reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoVencidos = (data?.resumen || []).filter(r => r.diasRestantes < 0).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoCriticos = (data?.resumen || []).filter(r => r.diasRestantes >= 0 && r.diasRestantes <= 15).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)
  const valorizadoUrgentes = (data?.resumen || []).filter(r => r.diasRestantes > 15 && r.diasRestantes <= 30).reduce((sum, r) => sum + (getValorizado(r) || 0), 0)

  function toggleExpand(articulo: string) {
    setExpanded(expanded === articulo ? null : articulo)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-[1800px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Frescura</h1>
            <Badge variant="outline" className="text-xs">Vencimientos + Piso</Badge>
            {vpdLoading && <span className="text-xs text-blue-500 animate-pulse">Cargando VPD Chess...</span>}
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
                <option key={d} value={d}>Almacén {d}</option>
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
              <FiltroCard label="Próx. 3 meses" value={data.totales.tresMeses} active={filtro === "3meses"} onClick={() => setFiltro("3meses")} color="border-blue-400" bgColor="bg-blue-50" textColor="text-blue-700" />
              <FiltroCard label="Vencidos" value={data.totales.vencidos} active={filtro === "vencidos"} onClick={() => setFiltro("vencidos")} color="border-red-400" bgColor="bg-red-50" textColor="text-red-700" />
              <FiltroCard label="Críticos (0-15d)" value={data.totales.criticos} active={filtro === "criticos"} onClick={() => setFiltro("criticos")} color="border-red-300" bgColor="bg-red-50" textColor="text-red-600" />
              <FiltroCard label="Urgentes (16-30d)" value={data.totales.urgentes} active={filtro === "urgentes"} onClick={() => setFiltro("urgentes")} color="border-amber-400" bgColor="bg-amber-50" textColor="text-amber-700" />
              <FiltroCard label="Atención (31-60d)" value={data.totales.atencion} active={filtro === "atencion"} onClick={() => setFiltro("atencion")} color="border-amber-300" bgColor="bg-amber-50" textColor="text-amber-600" />
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

            {/* Valorizado */}
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
              <Input placeholder="Buscar artículo o descripción..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm bg-white" />
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

            {/* Leyenda semáforo */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Piso OK (margen)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" /> Piso justo (70%+)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> No llega a vender</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300" /> Sin datos de venta</span>
            </div>

            {/* Main table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <ScrollArea>
                  <div className="min-w-max">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-8 text-center">#</TableHead>
                          <TableHead className="w-7 text-center">Piso</TableHead>
                          <TableHead className="w-20">Estado</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead className="max-w-[200px]">Descripción</TableHead>
                          <TableHead>División</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead className="text-center">Días Venc.</TableHead>
                          <TableHead className="text-center">Vencimiento</TableHead>
                          <TableHead className="text-right">VPD</TableHead>
                          <TableHead className="text-right">Días Piso</TableHead>
                          <TableHead className="text-right">Bultos Tot.</TableHead>
                          {preciosSKUs > 0 && <TableHead className="text-right">Valorizado</TableHead>}
                          <TableHead className="text-right">Unid. Tot.</TableHead>
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
                          const vpd = getVpd(r.articulo)
                          const diasPiso = getDiasDePiso(r)
                          const semaforo = calcSemaforo(diasPiso, r.diasRestantes)

                          return (
                            <>
                              <TableRow
                                key={`row-${r.articulo}-${i}`}
                                className={`${rowBg(r.diasRestantes)} cursor-pointer hover:bg-blue-50/50 transition-colors`}
                                onClick={() => toggleExpand(r.articulo)}
                              >
                                <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                                <TableCell className="text-center">
                                  <SemaforoDot semaforo={semaforo} />
                                </TableCell>
                                <TableCell><StatusBadge dias={r.diasRestantes} /></TableCell>
                                <TableCell className="font-mono text-sm text-slate-800">
                                  <span className="mr-1 text-slate-400">{isExpanded ? "▼" : "▶"}</span>
                                  {r.articulo}
                                </TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate text-slate-600">{r.descripcion}</TableCell>
                                <TableCell><DivisionBadge division={r.division} /></TableCell>
                                <TableCell className="text-xs text-slate-500 max-w-[100px] truncate">{r.marca}</TableCell>
                                <TableCell className="text-center">
                                  <span className={`font-bold text-lg ${diasColor(r.diasRestantes)}`}>{r.diasRestantes}</span>
                                </TableCell>
                                <TableCell className="text-center text-sm font-mono text-slate-600">{formatDate(r.vencimientoProximo)}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {vpd !== null ? (
                                    <span className="text-blue-600 font-medium">{vpd.toFixed(1)}</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {diasPiso !== null ? (
                                    <span className={`font-bold ${
                                      semaforo === "rojo" ? "text-red-600" : semaforo === "amarillo" ? "text-amber-600" : "text-emerald-600"
                                    }`}>{diasPiso.toFixed(0)}d</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm text-slate-700">{fmtNum(r.bultosTotal)}</TableCell>
                                {preciosSKUs > 0 && (
                                  <TableCell className="text-right text-sm tabular-nums">
                                    {(() => {
                                      const val = getValorizado(r)
                                      return val !== null ? (
                                        <span className="text-purple-700 font-semibold">{fmtMoney(val)}</span>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )
                                    })()}
                                  </TableCell>
                                )}
                                <TableCell className="text-right text-sm text-slate-400">{fmtNum(r.unidadesTotal)}</TableCell>
                                <TableCell className="text-center text-xs text-slate-400">{r.unidadesPorBulto > 1 ? r.unidadesPorBulto : <span className="text-red-400">1?</span>}</TableCell>
                                <TableCell className="text-center text-sm font-mono text-slate-500">{formatDate(r.fechaIngreso)}</TableCell>
                                <TableCell className="text-center text-sm font-semibold text-slate-600">{r.diasEnDeposito > 0 ? r.diasEnDeposito : "-"}</TableCell>
                                <TableCell className="text-center text-sm text-slate-500">{r.lotes}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={r.apto === "SI" ? "default" : "destructive"} className="text-xs">{r.apto || "-"}</Badge>
                                </TableCell>
                              </TableRow>

                              {isExpanded && (
                                <TableRow key={`detail-${r.articulo}`} className="bg-slate-50">
                                  <TableCell colSpan={preciosSKUs > 0 ? 19 : 18} className="p-0">
                                    <div className="px-8 py-3 border-y border-slate-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-slate-500">
                                          Contenedores — {r.articulo} {r.descripcion}
                                        </p>
                                        {vpd !== null && diasPiso !== null && (
                                          <p className="text-xs text-slate-500">
                                            VPD: <span className="text-blue-600 font-semibold">{vpd.toFixed(1)} blt/día</span>
                                            {" · "}Piso: <span className={`font-semibold ${semaforo === "rojo" ? "text-red-600" : semaforo === "amarillo" ? "text-amber-600" : "text-emerald-600"}`}>{diasPiso.toFixed(0)} días</span>
                                            {" · "}Vence en: <span className={`font-semibold ${diasColor(r.diasRestantes)}`}>{r.diasRestantes}d</span>
                                            {semaforo === "rojo" && <span className="text-red-600 font-bold ml-2">⚠ NO LLEGA A VENDER</span>}
                                          </p>
                                        )}
                                      </div>
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
                                              <TableCell className="text-xs text-right text-slate-400 py-1">{fmtNum(c.unidades)}</TableCell>
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
                            <TableCell colSpan={preciosSKUs > 0 ? 19 : 18} className="text-center py-8 text-slate-400">
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
      semaforo === "verde" ? "Piso OK — margen para vender"
      : semaforo === "amarillo" ? "Piso justo — 70%+ del tiempo"
      : semaforo === "rojo" ? "No llega a vender antes del vencimiento"
      : "Sin datos de venta (VPD)"
    } />
  )
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge className="bg-red-100 text-red-700 text-xs border-0">VENCIDO</Badge>
  if (dias <= 15) return <Badge className="bg-red-100 text-red-600 text-xs border-0">CRÍTICO</Badge>
  if (dias <= 30) return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">URGENTE</Badge>
  if (dias <= 60) return <Badge className="bg-amber-50 text-amber-600 text-xs border-0">ATENCIÓN</Badge>
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
