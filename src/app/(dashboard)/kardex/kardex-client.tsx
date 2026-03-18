"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  getKardexPageData,
  getKardexArticuloDetalle,
  type KardexPageData,
  type KardexArticuloDetalle,
  type KardexArticuloResumen,
} from "@/actions/kardex"
import { KpiCard } from "@/components/kpi-card"
import { DivisionBadge } from "@/components/division-badge"
import {
  Package,
  TrendingDown,
  TrendingUp,
  History,
  RefreshCw,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  AlertTriangle,
  Undo2,
  FileSpreadsheet,
} from "lucide-react"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 })
}

function fmtDate(fecha: string): string {
  const parts = fecha.split("-")
  return `${parts[2]}/${parts[1]}`
}

const CONCEPTO_COLORS: Record<string, string> = {
  "REC.DEPOS.": "text-green-700 bg-green-50",
  "CARGA": "text-red-700 bg-red-50",
  "DESCARGA": "text-blue-700 bg-blue-50",
  "SALDO INICIAL": "text-slate-700 bg-slate-100",
  "REMITO": "text-purple-700 bg-purple-50",
  "FALTANTE": "text-orange-700 bg-orange-50",
  "SOBRANTE": "text-teal-700 bg-teal-50",
  "DEVOLUCION": "text-amber-700 bg-amber-50",
  "RECUENTO": "text-indigo-700 bg-indigo-50",
  "ENV.DEPOS.": "text-sky-700 bg-sky-50",
  "REM.CONSIG.": "text-pink-700 bg-pink-50",
}

type SortKey = "codigo" | "saldoFinal" | "totalCargas" | "totalIngresos" | "saldoInicial" | "totalFaltantes" | "totalSobrantes" | "totalDevoluciones"
type SortDir = "asc" | "desc"

export function KardexClient() {
  const [pageData, setPageData] = useState<KardexPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selMes, setSelMes] = useState(new Date().getMonth() + 1)
  const [selAnio, setSelAnio] = useState(new Date().getFullYear())
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("totalCargas")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<KardexArticuloDetalle | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  const load = useCallback(async (mes?: number, anio?: number) => {
    setLoading(true)
    setSelectedSku(null)
    setDetailData(null)
    try {
      const d = await getKardexPageData(mes ?? selMes, anio ?? selAnio)
      setPageData(d)
    } finally {
      setLoading(false)
    }
  }, [selMes, selAnio])

  useEffect(() => { load() }, [load])

  function handleMesChange(mes: number) { setSelMes(mes); load(mes, selAnio) }
  function handleAnioChange(anio: number) { setSelAnio(anio); load(selMes, anio) }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/kardex", { method: "POST", body: fd })
      const json = await res.json()
      if (json.ok) {
        setUploadMsg(`${json.articulos} artículos, ${json.movimientos} movimientos (${json.fechaDesde} a ${json.fechaHasta})`)
        setSelMes(json.mes)
        setSelAnio(json.anio)
        load(json.mes, json.anio)
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

  async function handleSkuClick(art: string) {
    if (selectedSku === art) {
      setSelectedSku(null)
      setDetailData(null)
      return
    }
    setSelectedSku(art)
    setDetailLoading(true)
    try {
      const d = await getKardexArticuloDetalle(
        pageData?.kardex?.mes ?? selMes,
        pageData?.kardex?.anio ?? selAnio,
        art,
      )
      setDetailData(d)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filteredSkus = useMemo(() => {
    if (!pageData?.kardex) return []
    let items = pageData.kardex.resumenArticulos
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (s) =>
          s.codigo.toLowerCase().includes(q) ||
          s.descripcion.toLowerCase().includes(q)
      )
    }
    const sorted = [...items].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc"
        ? (Number(aVal) || 0) - (Number(bVal) || 0)
        : (Number(bVal) || 0) - (Number(aVal) || 0)
    })
    return sorted
  }, [pageData, search, sortKey, sortDir])

  // Loading state
  if (loading && !pageData) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando kardex...
      </div>
    )
  }

  const kardex = pageData?.kardex
  const mesLabel = kardex
    ? new Date(kardex.anio, kardex.mes - 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : `${MESES[selMes - 1]} ${selAnio}`

  // Chart data
  const chartData = kardex?.evolucionDiaria.map((d) => ({
    ...d,
    fechaShort: fmtDate(d.fecha),
  })) ?? []

  // Detail chart
  const detailChart = detailData?.evolucionDiaria.map((d) => ({
    ...d,
    fechaShort: fmtDate(d.fecha),
  }))

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kardex</h1>
          <p className="text-sm text-slate-500 capitalize">
            Movimientos reales — {mesLabel}
          </p>
          {kardex && (
            <p className="text-xs text-slate-400">
              {fmtDate(kardex.fechaDesde)} al {fmtDate(kardex.fechaHasta)} · Subido {new Date(kardex.uploadedAt).toLocaleString("es-AR")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selMes}
            onChange={(e) => handleMesChange(Number(e.target.value))}
            disabled={loading}
            className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selAnio}
            onChange={(e) => handleAnioChange(Number(e.target.value))}
            disabled={loading}
            className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
          >
            {[2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <label className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer
            ${uploading ? "opacity-50 pointer-events-none" : "text-emerald-600 border-emerald-300 hover:bg-emerald-50"}`}
          >
            <Upload className={`w-3.5 h-3.5 ${uploading ? "animate-spin" : ""}`} />
            {uploading ? "Subiendo..." : "Subir Excel"}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Upload message */}
      {uploadMsg && (
        <div className={`rounded-lg border px-4 py-2 text-sm flex items-center gap-2 ${
          uploadMsg.startsWith("Error") ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          {uploadMsg}
          <button onClick={() => setUploadMsg(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Empty state */}
      {!kardex && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-1">Sin datos para {mesLabel}</h3>
          <p className="text-sm text-slate-400 mb-4">
            Exportá el kardex desde Chess ERP y subilo acá
          </p>
          <label className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm cursor-pointer hover:bg-emerald-700">
            <Upload className="w-4 h-4" /> Subir Kardex Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Content when data exists */}
      {kardex && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              title="Stock Final"
              value={fmtNum(kardex.totales.stockFinal)}
              subtitle="bultos"
              icon={Package}
              color="blue"
            />
            <KpiCard
              title="Ingresos"
              value={fmtNum(kardex.totales.ingresos)}
              subtitle="REC.DEPOS."
              icon={TrendingUp}
              color="green"
            />
            <KpiCard
              title="Despachos"
              value={fmtNum(kardex.totales.cargas)}
              subtitle="CARGA"
              icon={TrendingDown}
              color="red"
            />
            <KpiCard
              title="Faltantes"
              value={fmtNum(kardex.totales.faltantes)}
              subtitle="bultos"
              icon={AlertTriangle}
              color="orange"
            />
            <KpiCard
              title="Sobrantes"
              value={fmtNum(kardex.totales.sobrantes)}
              subtitle="bultos"
              icon={TrendingUp}
              color="yellow"
            />
            <KpiCard
              title="Devoluciones"
              value={fmtNum(kardex.totales.devoluciones)}
              subtitle="bultos"
              icon={Undo2}
              color="default"
            />
          </div>

          {/* Stock Initial vs Final */}
          <div className="flex gap-3 text-xs text-slate-500">
            <span>Stock 1ro: <b className="text-slate-700">{fmtNum(kardex.totales.stockInicial)}</b></span>
            <span>|</span>
            <span>{kardex.articulosCount} artículos</span>
            <span>|</span>
            <span>{kardex.movimientosCount} movimientos</span>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-medium text-slate-600 mb-3">
                Evolución de Stock — {mesLabel}
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ left: 10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fechaShort" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(v) => `Fecha: ${v}`}
                    formatter={(v, name) => [fmtNum(Number(v)), String(name)]}
                  />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" opacity={0.6} />
                  <Bar dataKey="cargas" name="Despachos" fill="#ef4444" opacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey="stockFinal"
                    name="Stock"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SKU Detail */}
          {selectedSku && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-600">
                    Detalle: {selectedSku} — {detailData?.descripcion ?? ""}
                  </h3>
                  {detailData?.resumen && (
                    <p className="text-xs text-slate-400">
                      Stock: {fmtNum(detailData.resumen.saldoFinal)} · Despachos: {fmtNum(detailData.resumen.totalCargas)} · Ingresos: {fmtNum(detailData.resumen.totalIngresos)}
                      {detailData.resumen.totalFaltantes > 0 && ` · Faltantes: ${fmtNum(detailData.resumen.totalFaltantes)}`}
                    </p>
                  )}
                </div>
                <button onClick={() => { setSelectedSku(null); setDetailData(null) }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center h-40 text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Cargando detalle...
                </div>
              ) : detailData ? (
                <>
                  {/* Detail chart */}
                  {detailChart && detailChart.length > 0 && (
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={detailChart} margin={{ left: 10, right: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fechaShort" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(v) => `Fecha: ${v}`}
                          formatter={(v, name) => [fmtNum(Number(v)), String(name)]}
                        />
                        <Legend />
                        <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" opacity={0.6} />
                        <Bar dataKey="cargas" name="Despachos" fill="#ef4444" opacity={0.6} />
                        <Line type="monotone" dataKey="stockFinal" name="Stock" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}

                  {/* Movement log */}
                  <div className="mt-4 overflow-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="text-left text-xs text-slate-500 uppercase border-b">
                          <th className="p-2">Fecha</th>
                          <th className="p-2">Concepto</th>
                          <th className="p-2">Tipo</th>
                          <th className="p-2 text-right">Número</th>
                          <th className="p-2 text-right">Mov. Bultos</th>
                          <th className="p-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailData.movimientos.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 text-xs font-mono">{fmtDate(m.fecha)}</td>
                            <td className="p-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CONCEPTO_COLORS[m.concepto] ?? "text-slate-600 bg-slate-50"}`}>
                                {m.concepto}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-slate-500">{m.tipo || "-"}</td>
                            <td className="p-2 text-right text-xs font-mono text-slate-500">{m.numero || "-"}</td>
                            <td className={`p-2 text-right text-xs font-mono font-semibold ${
                              m.concepto === "RECUENTO" || m.concepto === "SALDO INICIAL" ? "text-slate-400"
                              : m.movBultos > 0 ? "text-green-600" : m.movBultos < 0 ? "text-red-600" : "text-slate-400"
                            }`}>
                              {m.concepto === "RECUENTO"
                                ? `R: ${m.recuentoBultos ?? "-"}`
                                : m.movBultos !== 0 ? (m.movBultos > 0 ? `+${fmtNum(m.movBultos)}` : fmtNum(m.movBultos)) : "-"
                              }
                            </td>
                            <td className="p-2 text-right text-xs font-mono font-semibold">
                              {m.concepto === "RECUENTO" ? "-" : fmtNum(m.saldoBultos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos para este artículo</p>
              )}
            </div>
          )}

          {/* SKU Table */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-medium text-slate-600">
                Resumen por SKU ({filteredSkus.length} artículos)
              </h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar artículo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg w-56"
                />
              </div>
            </div>

            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <TH col="codigo" label="Art." />
                    <th className="p-2">Descripción</th>
                    <TH col="saldoInicial" label="Stk Ini" right />
                    <TH col="saldoFinal" label="Stk Fin" right />
                    <TH col="totalIngresos" label="Ingresos" right />
                    <TH col="totalCargas" label="Despachos" right />
                    <TH col="totalFaltantes" label="Faltantes" right />
                    <TH col="totalSobrantes" label="Sobrantes" right />
                    <TH col="totalDevoluciones" label="Devol." right />
                    <th className="p-2 text-right">Recuento</th>
                    <th className="p-2 text-right">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSkus.map((s) => (
                    <tr
                      key={s.codigo}
                      onClick={() => handleSkuClick(s.codigo)}
                      className={`cursor-pointer transition-colors ${
                        selectedSku === s.codigo ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="p-2 font-mono text-xs">{s.codigo}</td>
                      <td className="p-2 max-w-[180px] truncate text-xs">{s.descripcion}</td>
                      <td className="p-2 text-right font-mono text-xs">{fmtNum(s.saldoInicial)}</td>
                      <td className="p-2 text-right font-mono text-xs font-semibold">{fmtNum(s.saldoFinal)}</td>
                      <td className="p-2 text-right font-mono text-xs text-green-600">
                        {s.totalIngresos > 0 ? fmtNum(s.totalIngresos) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-red-600">
                        {s.totalCargas > 0 ? fmtNum(s.totalCargas) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-orange-600">
                        {s.totalFaltantes > 0 ? fmtNum(s.totalFaltantes) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-teal-600">
                        {s.totalSobrantes > 0 ? fmtNum(s.totalSobrantes) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs">
                        {s.totalDevoluciones > 0 ? fmtNum(s.totalDevoluciones) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-indigo-600">
                        {s.recuentoBultos != null ? fmtNum(s.recuentoBultos) : "-"}
                      </td>
                      <td className={`p-2 text-right font-mono text-xs font-semibold ${
                        s.diferenciaRecuento == null ? "" :
                        s.diferenciaRecuento === 0 ? "text-green-600" :
                        s.diferenciaRecuento < 0 ? "text-red-600" : "text-orange-600"
                      }`}>
                        {s.diferenciaRecuento != null ? (s.diferenciaRecuento > 0 ? `+${fmtNum(s.diferenciaRecuento)}` : fmtNum(s.diferenciaRecuento)) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredSkus.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-xs">
                      <td className="p-2" colSpan={2}>TOTAL</td>
                      <td className="p-2 text-right font-mono">{fmtNum(kardex.totales.stockInicial)}</td>
                      <td className="p-2 text-right font-mono">{fmtNum(kardex.totales.stockFinal)}</td>
                      <td className="p-2 text-right font-mono text-green-600">{fmtNum(kardex.totales.ingresos)}</td>
                      <td className="p-2 text-right font-mono text-red-600">{fmtNum(kardex.totales.cargas)}</td>
                      <td className="p-2 text-right font-mono text-orange-600">{fmtNum(kardex.totales.faltantes)}</td>
                      <td className="p-2 text-right font-mono text-teal-600">{fmtNum(kardex.totales.sobrantes)}</td>
                      <td className="p-2 text-right font-mono">{fmtNum(kardex.totales.devoluciones)}</td>
                      <td className="p-2" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {filteredSkus.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                {search ? "No se encontraron artículos" : "Sin datos"}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )

  // Sortable TH helper
  function TH({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={`p-2 cursor-pointer hover:text-slate-700 ${right ? "text-right" : ""}`}
        onClick={() => handleSort(col)}
      >
        <span className={`flex items-center gap-1 ${right ? "justify-end" : ""}`}>
          {label} <SortIcon col={col} />
        </span>
      </th>
    )
  }
}
