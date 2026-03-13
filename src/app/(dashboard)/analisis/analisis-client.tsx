"use client"

import { useEffect, useState, useMemo } from "react"
import { getAnalisisData, type AnalisisData, type AnalisisItem } from "@/actions/analisis"
import { KpiCard } from "@/components/kpi-card"
import { DivisionBadge } from "@/components/division-badge"
import { DivisionFilter } from "@/components/division-filter"
import {
  RefreshCw,
  Package,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Cell,
} from "recharts"

const CLASIF_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  "sobre-stock": "bg-amber-100 text-amber-800",
  "sub-stock": "bg-red-100 text-red-800",
  "sin-venta": "bg-slate-100 text-slate-600",
  "sin-stock": "bg-purple-100 text-purple-800",
}

const CLASIF_LABELS: Record<string, string> = {
  ok: "OK",
  "sobre-stock": "Sobre-stock",
  "sub-stock": "Sub-stock",
  "sin-venta": "Sin venta",
  "sin-stock": "Sin stock",
}

const SCATTER_COLORS: Record<string, string> = {
  ok: "#10b981",
  "sobre-stock": "#f59e0b",
  "sub-stock": "#ef4444",
  "sin-venta": "#94a3b8",
}

const CHART_COLORS = [
  "#f59e0b", "#3b82f6", "#06b6d4", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
]

function fmtHl(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function AnalisisClient() {
  const [data, setData] = useState<AnalisisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [divFilter, setDivFilter] = useState("TODAS")
  const [search, setSearch] = useState("")

  useEffect(() => {
    getAnalisisData().then((d) => { setData(d); setLoading(false) })
  }, [])

  const divisiones = useMemo(() => {
    if (!data) return []
    return [...new Set(data.items.map((i) => i.division).filter(Boolean))].sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.items.filter((i) => {
      if (divFilter !== "TODAS" && i.division !== divFilter) return false
      if (search) {
        const t = search.toLowerCase()
        return i.articulo.includes(t) || i.descripcion.toLowerCase().includes(t) || i.marca.toLowerCase().includes(t)
      }
      return true
    })
  }, [data, divFilter, search])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando análisis cruzado...
      </div>
    )
  }

  // Scatter plot data (only items with VPD and diasRestantes)
  const scatterData = filtered
    .filter((i) => i.vpdBultos > 0 && i.diasRestantes !== null)
    .map((i) => ({
      x: i.vpdBultos,
      y: i.diasRestantes!,
      z: i.hlStock,
      name: `${i.articulo} - ${i.descripcion.slice(0, 30)}`,
      clasif: i.clasificacion,
    }))

  // Freshness by division (avg diasRestantes, colored by range)
  const frescuraPorDiv = data.porDivision
    .filter((d) => d.division !== "NO APLICABLE" && d.avgDiasRestantes > 0)
    .slice(0, 12)
    .map((d) => ({
      ...d,
      fill: d.avgDiasRestantes < 30 ? "#ef4444" : d.avgDiasRestantes < 60 ? "#f59e0b" : "#10b981",
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Análisis Cruzado</h1>
        <p className="text-sm text-slate-500">Stock vs Ventas vs Frescura — {data.totales.analizados} SKUs</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Analizados" value={data.totales.analizados} icon={Package} color="blue" />
        <KpiCard title="OK" value={data.totales.ok} icon={CheckCircle} color="green" />
        <KpiCard title="Sobre-stock" value={data.totales.sobreStock} subtitle="+60 días piso" icon={TrendingUp} color="yellow" />
        <KpiCard title="Sub-stock" value={data.totales.subStock} subtitle="-7 días piso" icon={TrendingDown} color="red" />
        <KpiCard title="Sin venta" value={data.totales.sinVenta} subtitle="sin VPD" icon={AlertTriangle} color="orange" />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Scatter: VPD vs Días Restantes */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">VPD vs Días Restantes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ bottom: 20, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="VPD (blt/d)" label={{ value: "VPD bultos/día", position: "bottom", offset: 0 }} />
              <YAxis type="number" dataKey="y" name="Días Restantes" />
              <ZAxis type="number" dataKey="z" range={[20, 400]} name="Stock HL" />
              <Tooltip />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label="30d" />
              <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label="60d" />
              <Scatter data={scatterData} name="SKUs">
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={SCATTER_COLORS[entry.clasif] || "#94a3b8"} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Freshness Score by Division */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Frescura por División (avg días restantes)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={frescuraPorDiv} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="division" width={90} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v} días`} />
              <Bar dataKey="avgDiasRestantes" name="Avg Días">
                {frescuraPorDiv.map((d, i) => (
                  <Cell key={i} fill={d.fill} radius={[0, 4, 4, 0] as unknown as number} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pareto Chart */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Pareto — Concentración de Stock (HL)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data.pareto.slice(0, 30)} margin={{ bottom: 50 }}>
            <XAxis dataKey="articulo" angle={-45} textAnchor="end" tick={{ fontSize: 9 }} height={60} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="hl" name="HL" fill="#3b82f6" />
            <Line yAxisId="right" type="monotone" dataKey="acumuladoPct" name="% Acumulado" stroke="#ef4444" strokeWidth={2} dot={false} />
            <ReferenceLine yAxisId="right" y={80} stroke="#ef4444" strokeDasharray="3 3" label="80%" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-600">Detalle de Cobertura</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          <DivisionFilter value={divFilter} onChange={setDivFilter} divisiones={divisiones} />
        </div>

        <div className="text-xs text-slate-400">{filtered.length} artículos</div>

        <div className="overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="p-2">Art.</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">División</th>
                <th className="p-2 text-right">Stock (blt)</th>
                <th className="p-2 text-right">Stock (HL)</th>
                <th className="p-2 text-right">VPD (blt/d)</th>
                <th className="p-2 text-right">Días Piso</th>
                <th className="p-2 text-right">Días Venc.</th>
                <th className="p-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 200).map((item) => (
                <tr key={item.articulo} className="hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs">{item.articulo}</td>
                  <td className="p-2 max-w-[200px] truncate">{item.descripcion}</td>
                  <td className="p-2"><DivisionBadge division={item.division} /></td>
                  <td className="p-2 text-right font-mono text-xs">{item.bultosStock.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono text-xs">{fmtHl(item.hlStock)}</td>
                  <td className="p-2 text-right font-mono text-xs">{item.vpdBultos > 0 ? item.vpdBultos.toFixed(1) : "-"}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold">{item.diasPiso !== null ? `${item.diasPiso.toFixed(0)}d` : "-"}</td>
                  <td className="p-2 text-right font-mono text-xs">{item.diasRestantes !== null ? `${item.diasRestantes}d` : "-"}</td>
                  <td className="p-2 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASIF_COLORS[item.clasificacion]}`}>
                      {CLASIF_LABELS[item.clasificacion]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="text-xs text-slate-400 p-2 text-center">
              Mostrando 200 de {filtered.length}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
