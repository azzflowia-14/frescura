"use client"

import { useEffect, useState } from "react"
import { getOcupacionData, type OcupacionData } from "@/actions/ocupacion"
import { KpiCard } from "@/components/kpi-card"
import { Warehouse, RefreshCw, Lock, Layers } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

export function OcupacionClient() {
  const [data, setData] = useState<OcupacionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cd, setCd] = useState("TODOS")

  async function load(selectedCd?: string) {
    setLoading(true)
    try {
      const result = await getOcupacionData(selectedCd ?? cd)
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(), 120_000)
    return () => clearInterval(interval)
  }, [])

  function handleCdChange(newCd: string) {
    setCd(newCd)
    load(newCd)
  }

  const r = data?.resumen

  const carasData = r
    ? Object.entries(r.porCara)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cara, info]) => ({
          name: `Cara ${cara}`,
          ocupadas: info.ocupadas,
          libres: info.total - info.ocupadas,
          pct: info.porcentaje,
        }))
    : []

  const estadosData = r
    ? Object.entries(r.porEstado)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, value]) => ({ name, value }))
    : []

  const nivelesData = r
    ? Object.entries(r.porNivel)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([nivel, info]) => ({
          name: `Nivel ${nivel}`,
          ocupadas: info.ocupadas,
          libres: info.total - info.ocupadas,
        }))
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-blue-400" />
            Ocupación del Depósito
          </h1>
          <p className="text-sm text-zinc-400">
            Distribución de ubicaciones en tiempo real
            {cd !== "TODOS" && <span className="text-blue-400 ml-1">— Almacén {cd}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro por Almacén/CD */}
          <select
            value={cd}
            onChange={(e) => handleCdChange(e.target.value)}
            className="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200"
          >
            <option value="TODOS">Todos los almacenes</option>
            {data?.cdsDisponibles.map((c) => (
              <option key={c} value={c}>
                Almacén {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {data?.error && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-3">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : r ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Ocupación"
              value={`${r.porcentajeOcupacion}%`}
              subtitle={`${r.ocupadas.toLocaleString("es-AR")} ubicaciones`}
              icon={Warehouse}
              color={r.porcentajeOcupacion > 90 ? "red" : r.porcentajeOcupacion > 75 ? "orange" : "green"}
            />
            <KpiCard
              title="Total Ubicaciones"
              value={r.totalUbicaciones.toLocaleString("es-AR")}
              icon={Layers}
              color="blue"
            />
            <KpiCard
              title="Libres"
              value={r.libres.toLocaleString("es-AR")}
              subtitle="disponibles"
              icon={Warehouse}
              color="green"
            />
            <KpiCard
              title="Inhibidas"
              value={r.inhibidas}
              subtitle="bloqueadas"
              icon={Lock}
              color={r.inhibidas > 0 ? "yellow" : "default"}
            />
          </div>

          {/* Ocupación bar grande */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-300 font-medium">
                Capacidad {cd !== "TODOS" ? `Almacén ${cd}` : "General"}
              </span>
              <span className="text-lg font-bold text-white tabular-nums">{r.porcentajeOcupacion}%</span>
            </div>
            <div className="w-full h-6 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  r.porcentajeOcupacion > 90
                    ? "bg-gradient-to-r from-red-600 to-red-400"
                    : r.porcentajeOcupacion > 75
                    ? "bg-gradient-to-r from-orange-600 to-orange-400"
                    : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                }`}
                style={{ width: `${r.porcentajeOcupacion}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-zinc-500">0%</span>
              <span className="text-xs text-zinc-500">100%</span>
            </div>
          </div>

          {/* Comparativa de almacenes (solo cuando se ve TODOS) */}
          {cd === "TODOS" && data?.cdsDisponibles && data.cdsDisponibles.length > 1 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Comparativa por Almacén</h3>
              <div className="space-y-2">
                {data.cdsDisponibles.map((c) => {
                  const items = r.detalle.filter((d) => d.cd === c)
                  // Si el detalle fue limitado, caemos en los datos del total
                  const total = items.length || 0
                  const ocup = items.filter((d) => d.articulo && d.articulo !== "" && d.articulo !== "null").length
                  const pct = total > 0 ? Math.round((ocup / total) * 100) : 0
                  return (
                    <button
                      key={c}
                      onClick={() => handleCdChange(c)}
                      className="w-full flex items-center gap-3 hover:bg-zinc-700/30 rounded-md p-1 transition-colors"
                    >
                      <span className="text-xs text-zinc-300 font-medium w-24 shrink-0 text-left">Almacén {c}</span>
                      <div className="flex-1 h-4 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 90 ? "bg-red-500" : pct > 75 ? "bg-orange-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 tabular-nums w-10 text-right">{pct}%</span>
                      <span className="text-xs text-zinc-500 tabular-nums w-24 text-right">
                        {ocup}/{total} ubic.
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {carasData.length > 0 && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Ocupación por Cara</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={carasData}>
                    <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                    />
                    <Bar dataKey="ocupadas" stackId="a" fill="#3b82f6" name="Ocupadas" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="libres" stackId="a" fill="#27272a" name="Libres" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {estadosData.length > 0 && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Distribución por Estado</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={estadosData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {estadosData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Ocupación por Nivel */}
          {nivelesData.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Ocupación por Nivel de Estantería</h3>
              <div className="space-y-2">
                {nivelesData.map((n) => {
                  const total = n.ocupadas + n.libres
                  const pct = total > 0 ? Math.round((n.ocupadas / total) * 100) : 0
                  return (
                    <div key={n.name} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-16 shrink-0">{n.name}</span>
                      <div className="flex-1 h-3 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 tabular-nums w-12 text-right">{pct}%</span>
                      <span className="text-xs text-zinc-500 tabular-nums w-20 text-right">
                        {n.ocupadas}/{total}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
