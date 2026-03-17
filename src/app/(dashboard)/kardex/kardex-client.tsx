"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { getKardexData, type KardexData, type KardexSku } from "@/actions/kardex"
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

type SortKey = "articulo" | "stockHoy" | "vendido" | "ingresado" | "stockInicio"
type SortDir = "asc" | "desc"

export function KardexClient() {
  const [data, setData] = useState<KardexData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selMes, setSelMes] = useState(new Date().getMonth() + 1)
  const [selAnio, setSelAnio] = useState(new Date().getFullYear())
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("vendido")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<KardexData | null>(null)

  const load = useCallback(async (mes?: number, anio?: number) => {
    setLoading(true)
    setSelectedSku(null)
    setDetailData(null)
    try {
      const d = await getKardexData(mes ?? selMes, anio ?? selAnio)
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [selMes, selAnio])

  useEffect(() => {
    load()
  }, [load])

  function handleMesChange(mes: number) {
    setSelMes(mes)
    load(mes, selAnio)
  }

  function handleAnioChange(anio: number) {
    setSelAnio(anio)
    load(selMes, anio)
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
      const d = await getKardexData(data?.mes ?? selMes, data?.anio ?? selAnio, art)
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
    if (!data) return []
    let items = data.porSku
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (s) =>
          s.articulo.toLowerCase().includes(q) ||
          s.descripcion.toLowerCase().includes(q) ||
          s.division.toLowerCase().includes(q)
      )
    }
    const sorted = [...items].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [data, search, sortKey, sortDir])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando kardex...
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <p>{data.error}</p>
      </div>
    )
  }

  const mesLabel = new Date(data.anio, data.mes - 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })

  // Chart data for evolution
  const chartData = data.evolucion.map((d) => ({
    ...d,
    fechaShort: d.fecha.split("-").slice(1).reverse().join("/"),
  }))

  // Detail chart
  const detailChart = detailData?.detalleSku?.map((d) => ({
    ...d,
    fechaShort: d.fecha.split("-").slice(1).reverse().join("/"),
  }))

  const selectedSkuInfo = selectedSku ? data.porSku.find((s) => s.articulo === selectedSku) : null

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
          <p className="text-sm text-slate-500 capitalize">Evolución de stock — {mesLabel}</p>
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
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Stock HOY"
          value={fmtNum(data.totales.stockHoy)}
          subtitle="bultos"
          icon={Package}
          color="blue"
        />
        <KpiCard
          title="Ventas del Mes"
          value={fmtNum(data.totales.totalVentas)}
          subtitle="bultos vendidos"
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          title="Ingresos del Mes"
          value={fmtNum(data.totales.totalIngresos)}
          subtitle="bultos ingresados"
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          title="Stock Est. 1ro"
          value={fmtNum(data.totales.stockEstimadoInicio)}
          subtitle="inicio del mes"
          icon={History}
          color="default"
        />
      </div>

      {/* Gráfico evolución total */}
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
              <Bar dataKey="ventas" name="Ventas" fill="#ef4444" opacity={0.6} />
              <Line
                type="monotone"
                dataKey="stockEstimado"
                name="Stock Estimado"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detalle SKU seleccionado */}
      {selectedSku && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-slate-600">
                Detalle: {selectedSku} — {selectedSkuInfo?.descripcion ?? ""}
              </h3>
              {selectedSkuInfo && (
                <p className="text-xs text-slate-400">
                  Stock hoy: {fmtNum(selectedSkuInfo.stockHoy)} · Vendido: {fmtNum(selectedSkuInfo.vendido)} · Ingresado: {fmtNum(selectedSkuInfo.ingresado)}
                </p>
              )}
            </div>
            <button
              onClick={() => { setSelectedSku(null); setDetailData(null) }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Cargando detalle...
            </div>
          ) : detailChart && detailChart.length > 0 ? (
            <>
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
                  <Bar dataKey="ventas" name="Ventas" fill="#ef4444" opacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey="stockEstimado"
                    name="Stock Estimado"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Tabla detalle día a día */}
              <div className="mt-4 overflow-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-xs text-slate-500 uppercase border-b">
                      <th className="p-2">Fecha</th>
                      <th className="p-2 text-right">Stock Estimado</th>
                      <th className="p-2 text-right text-green-600">+ Ingresos</th>
                      <th className="p-2 text-right text-red-600">- Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailData!.detalleSku!.map((d) => {
                      const parts = d.fecha.split("-")
                      const fechaFmt = `${parts[2]}/${parts[1]}`
                      return (
                        <tr key={d.fecha} className="hover:bg-slate-50">
                          <td className="p-2 text-xs">{fechaFmt}</td>
                          <td className="p-2 text-right font-mono text-xs font-semibold">{fmtNum(d.stockEstimado)}</td>
                          <td className="p-2 text-right font-mono text-xs text-green-600">
                            {d.ingresos > 0 ? `+${fmtNum(d.ingresos)}` : "-"}
                          </td>
                          <td className="p-2 text-right font-mono text-xs text-red-600">
                            {d.ventas > 0 ? `-${fmtNum(d.ventas)}` : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Sin datos para este artículo</p>
          )}
        </div>
      )}

      {/* Tabla por SKU */}
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
                <th
                  className="p-2 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("articulo")}
                >
                  <span className="flex items-center gap-1">Art. <SortIcon col="articulo" /></span>
                </th>
                <th className="p-2">Descripción</th>
                <th className="p-2">División</th>
                <th
                  className="p-2 text-right cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("stockHoy")}
                >
                  <span className="flex items-center justify-end gap-1">Stock Hoy <SortIcon col="stockHoy" /></span>
                </th>
                <th
                  className="p-2 text-right cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("vendido")}
                >
                  <span className="flex items-center justify-end gap-1">Vendido <SortIcon col="vendido" /></span>
                </th>
                <th
                  className="p-2 text-right cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("ingresado")}
                >
                  <span className="flex items-center justify-end gap-1">Ingresado <SortIcon col="ingresado" /></span>
                </th>
                <th
                  className="p-2 text-right cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("stockInicio")}
                >
                  <span className="flex items-center justify-end gap-1">Stock 1ro <SortIcon col="stockInicio" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSkus.map((s) => (
                <tr
                  key={s.articulo}
                  onClick={() => handleSkuClick(s.articulo)}
                  className={`cursor-pointer transition-colors ${
                    selectedSku === s.articulo
                      ? "bg-blue-50 hover:bg-blue-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="p-2 font-mono text-xs">{s.articulo}</td>
                  <td className="p-2 max-w-[200px] truncate text-xs">{s.descripcion}</td>
                  <td className="p-2"><DivisionBadge division={s.division} /></td>
                  <td className="p-2 text-right font-mono text-xs font-semibold">{fmtNum(s.stockHoy)}</td>
                  <td className="p-2 text-right font-mono text-xs text-red-600">
                    {s.vendido > 0 ? fmtNum(s.vendido) : "-"}
                  </td>
                  <td className="p-2 text-right font-mono text-xs text-green-600">
                    {s.ingresado > 0 ? fmtNum(s.ingresado) : "-"}
                  </td>
                  <td className="p-2 text-right font-mono text-xs">{fmtNum(s.stockInicio)}</td>
                </tr>
              ))}
            </tbody>
            {filteredSkus.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold text-xs">
                  <td className="p-2" colSpan={3}>TOTAL</td>
                  <td className="p-2 text-right font-mono">{fmtNum(data.totales.stockHoy)}</td>
                  <td className="p-2 text-right font-mono text-red-600">{fmtNum(data.totales.totalVentas)}</td>
                  <td className="p-2 text-right font-mono text-green-600">{fmtNum(data.totales.totalIngresos)}</td>
                  <td className="p-2 text-right font-mono">{fmtNum(data.totales.stockEstimadoInicio)}</td>
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

      <p className="text-xs text-slate-300 text-right">
        Actualizado: {new Date(data.timestamp).toLocaleString("es-AR")}
      </p>
    </div>
  )
}
