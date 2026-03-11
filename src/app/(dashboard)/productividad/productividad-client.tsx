"use client"

import { useEffect, useState } from "react"
import { getProductividadData, type ProductividadData } from "@/actions/productividad"
import { KpiCard } from "@/components/kpi-card"
import { Users, Clock, Package, RefreshCw, Boxes, Trophy } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6"]

export function ProductividadClient() {
  const [data, setData] = useState<ProductividadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])

  async function load(f?: string) {
    setLoading(true)
    try {
      const result = await getProductividadData(f || fecha)
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleFechaChange(f: string) {
    setFecha(f)
    load(f)
  }

  const topOperarios = data
    ? data.operarios.slice(0, 10).map((o) => ({
        name: o.usuario.length > 12 ? o.usuario.slice(0, 12) + "…" : o.usuario,
        unidades: o.unidadesTotal,
        bultos: o.bultosTotal,
        eficiencia: o.eficiencia,
      }))
    : []

  const tareasData = data
    ? Object.entries(data.porTarea)
        .sort((a, b) => b[1].unidades - a[1].unidades)
        .map(([tarea, info]) => ({
          name: tarea.length > 20 ? tarea.slice(0, 20) + "…" : tarea,
          unidades: info.unidades,
          bultos: info.bultos,
          usuarios: info.usuarios,
          tiempo: info.tiempo,
        }))
    : []

  const formatTime = (min: number) => {
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Productividad
          </h1>
          <p className="text-sm text-slate-400">Rendimiento de operarios por día</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => handleFechaChange(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
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
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard title="Operarios" value={data.totales.operarios} subtitle="activos este día" icon={Users} color="blue" />
            <KpiCard title="Tiempo Total" value={formatTime(data.totales.tiempoTotalMin)} icon={Clock} color="default" />
            <KpiCard title="Unidades" value={data.totales.unidadesTotal.toLocaleString("es-AR")} icon={Package} color="green" />
            <KpiCard title="Bultos" value={data.totales.bultosTotal.toLocaleString("es-AR")} icon={Boxes} color="blue" />
            <KpiCard title="Pallets" value={data.totales.palletsTotal.toLocaleString("es-AR")} icon={Boxes} color="orange" />
          </div>

          {/* Chart Ranking */}
          {topOperarios.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Ranking de Operarios (por unidades)
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(250, topOperarios.length * 35)}>
                <BarChart data={topOperarios} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#64748b", fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#334155" }}
                    formatter={(value) => [Number(value).toLocaleString("es-AR"), "Unidades"]}
                  />
                  <Bar dataKey="unidades" radius={[0, 6, 6, 0]}>
                    {topOperarios.map((_, i) => (
                      <Cell key={i} fill={RANK_COLORS[i] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table Operarios */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-600">Detalle por Operario</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">#</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Operario</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Tiempo</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Unidades</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Bultos</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Pallets</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Tareas</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Eficiencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operarios.map((o, i) => (
                    <tr key={o.usuario} className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">
                        {i < 3 ? (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            i === 0 ? "bg-amber-100 text-amber-700" :
                            i === 1 ? "bg-slate-200 text-slate-600" :
                            "bg-orange-100 text-orange-700"
                          }`}>{i + 1}</span>
                        ) : i + 1}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 font-medium">{o.usuario}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{formatTime(o.tiempoTotalMin)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold tabular-nums">{o.unidadesTotal.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-2.5 text-right text-blue-600 tabular-nums">{o.bultosTotal.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600 tabular-nums">{o.palletsTotal.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{o.tareas}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-medium tabular-nums ${
                          o.eficiencia > 10 ? "text-emerald-600" : o.eficiencia > 5 ? "text-blue-600" : "text-slate-500"
                        }`}>
                          {o.eficiencia.toFixed(1)} u/min
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.operarios.length === 0 && (
              <div className="p-8 text-center text-slate-400">Sin datos de productividad para este día</div>
            )}
          </div>

          {/* Breakdown por Tarea */}
          {tareasData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-600">Desglose por Tarea</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Tarea</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Usuarios</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Unidades</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Bultos</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tareasData.map((t) => (
                      <tr key={t.name} className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{t.name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{t.usuarios}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-medium tabular-nums">{t.unidades.toLocaleString("es-AR")}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600 tabular-nums">{t.bultos.toLocaleString("es-AR")}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{formatTime(t.tiempo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
