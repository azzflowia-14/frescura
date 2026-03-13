"use client"

import { useEffect, useState } from "react"
import { getFefoData, type FefoData } from "@/actions/fefo"
import { KpiCard } from "@/components/kpi-card"
import { AlertTriangle, RefreshCw, ShieldAlert, Building2 } from "lucide-react"
import { DivisionBadge } from "@/components/division-badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

export function FefoClient() {
  const [data, setData] = useState<FefoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [divFilter, setDivFilter] = useState("TODAS")

  async function load() {
    setLoading(true)
    try {
      const result = await getFefoData()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [])

  const divisiones = [...new Set((data?.violations || []).map((v) => v.division).filter(Boolean))].sort()

  const filtered = data?.violations.filter((v) => {
    if (divFilter !== "TODAS" && v.division !== divFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      v.pickingArticulo.toLowerCase().includes(s) ||
      v.almacenArticulo.toLowerCase().includes(s) ||
      v.empresa.toLowerCase().includes(s)
    )
  })

  const topArticulos = data
    ? Object.entries(data.totales.porArticulo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, value }))
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            FEFO Vulnerado
          </h1>
          <p className="text-sm text-slate-400">
            Producto más nuevo sacado antes que producto más viejo (violación First Expiry First Out)
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{data.error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Total Violaciones"
              value={data.totales.total}
              icon={AlertTriangle}
              color={data.totales.total > 0 ? "red" : "green"}
            />
            <KpiCard title="Empresas Afectadas" value={Object.keys(data.totales.porEmpresa).length} icon={Building2} color="orange" />
            <KpiCard title="Artículos Afectados" value={Object.keys(data.totales.porArticulo).length} icon={AlertTriangle} color="yellow" />
            <KpiCard
              title="Peor Diferencia"
              value={data.violations.length > 0 ? `${Math.max(...data.violations.map((v) => v.diasDiferencia))} días` : "0 días"}
              subtitle="entre picking y almacén"
              icon={ShieldAlert}
              color="red"
            />
          </div>

          {/* Chart */}
          {topArticulos.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Top Artículos con Violaciones FEFO</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topArticulos} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#64748b", fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#334155" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {topArticulos.map((_, i) => (
                      <Cell key={i} fill={i < 3 ? "#ef4444" : i < 6 ? "#f97316" : "#eab308"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Search + Division filter */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por artículo o empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <select
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
              className="px-2 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="TODAS">Todas las divisiones</option>
              {divisiones.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">#</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">División</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Artículo (Picking)</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Venc. Picking</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Ubicación Pick.</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Artículo (Almacén)</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Venc. Almacén</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Ubicación Alm.</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Dif. Días</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((v, i) => (
                    <tr key={i} className={`border-b border-slate-50 hover:bg-blue-50/50 transition-colors ${v.diasDiferencia > 30 ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-700">{v.empresa}</td>
                      <td className="px-4 py-2.5"><DivisionBadge division={v.division} /></td>
                      <td className="px-4 py-2.5 text-slate-800 font-mono text-xs">{v.pickingArticulo}</td>
                      <td className="px-4 py-2.5 text-red-600 tabular-nums font-medium">{v.pickingVencimiento}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{v.pickingUbicacion}</td>
                      <td className="px-4 py-2.5 text-slate-800 font-mono text-xs">{v.almacenArticulo}</td>
                      <td className="px-4 py-2.5 text-emerald-600 tabular-nums font-medium">{v.almacenVencimiento}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{v.almacenUbicacion}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                          v.diasDiferencia > 30 ? "bg-red-100 text-red-700" : v.diasDiferencia > 7 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {v.diasDiferencia}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered && filtered.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                {data.totales.total === 0 ? "Sin violaciones FEFO detectadas" : "Sin resultados para la búsqueda"}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
