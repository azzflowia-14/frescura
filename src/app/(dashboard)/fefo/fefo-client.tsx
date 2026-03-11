"use client"

import { useEffect, useState } from "react"
import { getFefoData, type FefoData } from "@/actions/fefo"
import { KpiCard } from "@/components/kpi-card"
import { AlertTriangle, RefreshCw, ShieldAlert, Building2 } from "lucide-react"
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

  const filtered = data?.violations.filter((v) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      v.pickingArticulo.toLowerCase().includes(s) ||
      v.almacenArticulo.toLowerCase().includes(s) ||
      v.empresa.toLowerCase().includes(s)
    )
  })

  // Top artículos con más violaciones
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            FEFO Vulnerado
          </h1>
          <p className="text-sm text-zinc-400">
            Producto más nuevo sacado antes que producto más viejo (violación First Expiry First Out)
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data?.error && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-3">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
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
            <KpiCard
              title="Empresas Afectadas"
              value={Object.keys(data.totales.porEmpresa).length}
              icon={Building2}
              color="orange"
            />
            <KpiCard
              title="Artículos Afectados"
              value={Object.keys(data.totales.porArticulo).length}
              icon={AlertTriangle}
              color="yellow"
            />
            <KpiCard
              title="Peor Diferencia"
              value={
                data.violations.length > 0
                  ? `${Math.max(...data.violations.map((v) => v.diasDiferencia))} días`
                  : "0 días"
              }
              subtitle="entre picking y almacén"
              icon={ShieldAlert}
              color="red"
            />
          </div>

          {/* Chart - Top artículos */}
          {topArticulos.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Artículos con Violaciones FEFO</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topArticulos} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topArticulos.map((_, i) => (
                      <Cell key={i} fill={i < 3 ? "#ef4444" : i < 6 ? "#f97316" : "#eab308"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Buscar por artículo o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-500"
          />

          {/* Table */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50 bg-zinc-800/50">
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Empresa</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Artículo (Picking)</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Venc. Picking</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Ubicación Pick.</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Artículo (Almacén)</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Venc. Almacén</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Ubicación Alm.</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Dif. Días</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((v, i) => (
                    <tr
                      key={i}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                        v.diasDiferencia > 30 ? "bg-red-950/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-500 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 text-zinc-300">{v.empresa}</td>
                      <td className="px-3 py-2 text-zinc-200 font-mono text-xs">{v.pickingArticulo}</td>
                      <td className="px-3 py-2 text-red-400 tabular-nums">{v.pickingVencimiento}</td>
                      <td className="px-3 py-2 text-zinc-400 text-xs">{v.pickingUbicacion}</td>
                      <td className="px-3 py-2 text-zinc-200 font-mono text-xs">{v.almacenArticulo}</td>
                      <td className="px-3 py-2 text-emerald-400 tabular-nums">{v.almacenVencimiento}</td>
                      <td className="px-3 py-2 text-zinc-400 text-xs">{v.almacenUbicacion}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums ${
                            v.diasDiferencia > 30
                              ? "bg-red-500/20 text-red-400"
                              : v.diasDiferencia > 7
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {v.diasDiferencia}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered && filtered.length === 0 && (
              <div className="p-8 text-center text-zinc-500">
                {data.totales.total === 0 ? "Sin violaciones FEFO detectadas" : "Sin resultados para la búsqueda"}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
