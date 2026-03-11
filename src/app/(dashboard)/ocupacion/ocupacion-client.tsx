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

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

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
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-blue-500" />
            Ocupación del Depósito
          </h1>
          <p className="text-sm text-slate-400">
            Distribución de ubicaciones en tiempo real
            {cd !== "TODOS" && <span className="text-blue-600 font-medium ml-1">— Almacén {cd}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={cd}
            onChange={(e) => handleCdChange(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="TODOS">Todos los almacenes</option>
            {data?.cdsDisponibles.map((c) => (
              <option key={c} value={c}>Almacén {c}</option>
            ))}
          </select>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {data?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{data.error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
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
            <KpiCard title="Total Ubicaciones" value={r.totalUbicaciones.toLocaleString("es-AR")} icon={Layers} color="blue" />
            <KpiCard title="Libres" value={r.libres.toLocaleString("es-AR")} subtitle="disponibles" icon={Warehouse} color="green" />
            <KpiCard title="Inhibidas" value={r.inhibidas} subtitle="bloqueadas" icon={Lock} color={r.inhibidas > 0 ? "yellow" : "default"} />
          </div>

          {/* Ocupación bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 font-medium">
                Capacidad {cd !== "TODOS" ? `Almacén ${cd}` : "General"}
              </span>
              <span className="text-lg font-bold text-slate-800 tabular-nums">{r.porcentajeOcupacion}%</span>
            </div>
            <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  r.porcentajeOcupacion > 90
                    ? "bg-gradient-to-r from-red-500 to-red-400"
                    : r.porcentajeOcupacion > 75
                    ? "bg-gradient-to-r from-orange-500 to-orange-400"
                    : "bg-gradient-to-r from-blue-500 to-blue-400"
                }`}
                style={{ width: `${r.porcentajeOcupacion}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">0%</span>
              <span className="text-xs text-slate-400">100%</span>
            </div>
          </div>

          {/* Comparativa de almacenes */}
          {cd === "TODOS" && data?.cdsDisponibles && data.cdsDisponibles.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Comparativa por Almacén</h3>
              <div className="space-y-2">
                {data.cdsDisponibles.map((c) => {
                  const items = r.detalle.filter((d) => d.cd === c)
                  const total = items.length || 0
                  const ocup = items.filter((d) => d.articulo && d.articulo !== "" && d.articulo !== "null").length
                  const pct = total > 0 ? Math.round((ocup / total) * 100) : 0
                  return (
                    <button
                      key={c}
                      onClick={() => handleCdChange(c)}
                      className="w-full flex items-center gap-3 hover:bg-blue-50 rounded-lg p-1.5 transition-colors"
                    >
                      <span className="text-xs text-slate-600 font-semibold w-24 shrink-0 text-left">Almacén {c}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 90 ? "bg-red-400" : pct > 75 ? "bg-orange-400" : "bg-blue-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums w-10 text-right font-medium">{pct}%</span>
                      <span className="text-xs text-slate-400 tabular-nums w-24 text-right">
                        {ocup}/{total} ubic.
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {carasData.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Ocupación por Cara</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={carasData}>
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#334155" }} />
                    <Bar dataKey="ocupadas" stackId="a" fill="#3b82f6" name="Ocupadas" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="libres" stackId="a" fill="#e2e8f0" name="Libres" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {estadosData.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Distribución por Estado</h3>
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
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#334155" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Niveles */}
          {nivelesData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Ocupación por Nivel de Estantería</h3>
              <div className="space-y-2.5">
                {nivelesData.map((n) => {
                  const total = n.ocupadas + n.libres
                  const pct = total > 0 ? Math.round((n.ocupadas / total) * 100) : 0
                  return (
                    <div key={n.name} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium w-16 shrink-0">{n.name}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums w-12 text-right font-medium">{pct}%</span>
                      <span className="text-xs text-slate-400 tabular-nums w-20 text-right">{n.ocupadas}/{total}</span>
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
