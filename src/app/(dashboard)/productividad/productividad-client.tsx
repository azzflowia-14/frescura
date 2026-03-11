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

  // Top 10 operarios para el chart
  const topOperarios = data
    ? data.operarios.slice(0, 10).map((o) => ({
        name: o.usuario.length > 12 ? o.usuario.slice(0, 12) + "…" : o.usuario,
        unidades: o.unidadesTotal,
        bultos: o.bultosTotal,
        eficiencia: o.eficiencia,
      }))
    : []

  // Tareas para breakdown
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Productividad
          </h1>
          <p className="text-sm text-zinc-400">Rendimiento de operarios por día</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => handleFechaChange(e.target.value)}
            className="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200"
          />
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
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard
              title="Operarios"
              value={data.totales.operarios}
              subtitle="activos este día"
              icon={Users}
              color="blue"
            />
            <KpiCard
              title="Tiempo Total"
              value={formatTime(data.totales.tiempoTotalMin)}
              icon={Clock}
              color="default"
            />
            <KpiCard
              title="Unidades"
              value={data.totales.unidadesTotal.toLocaleString("es-AR")}
              icon={Package}
              color="green"
            />
            <KpiCard
              title="Bultos"
              value={data.totales.bultosTotal.toLocaleString("es-AR")}
              icon={Boxes}
              color="blue"
            />
            <KpiCard
              title="Pallets"
              value={data.totales.palletsTotal.toLocaleString("es-AR")}
              icon={Boxes}
              color="orange"
            />
          </div>

          {/* Chart - Ranking operarios */}
          {topOperarios.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Ranking de Operarios (por unidades)
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(250, topOperarios.length * 35)}>
                <BarChart data={topOperarios} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                    formatter={(value) => [Number(value).toLocaleString("es-AR"), "Unidades"]}
                  />
                  <Bar dataKey="unidades" radius={[0, 4, 4, 0]}>
                    {topOperarios.map((_, i) => (
                      <Cell key={i} fill={RANK_COLORS[i] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table - Detalle operarios */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-700/50">
              <h3 className="text-sm font-medium text-zinc-300">Detalle por Operario</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50 bg-zinc-800/50">
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Operario</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Tiempo</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Unidades</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Bultos</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Pallets</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Tareas</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Eficiencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operarios.map((o, i) => (
                    <tr
                      key={o.usuario}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-2 text-zinc-500 tabular-nums">
                        {i < 3 ? (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                            i === 1 ? "bg-zinc-500/20 text-zinc-300" :
                            "bg-orange-500/20 text-orange-400"
                          }`}>{i + 1}</span>
                        ) : i + 1}
                      </td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{o.usuario}</td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{formatTime(o.tiempoTotalMin)}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-medium tabular-nums">
                        {o.unidadesTotal.toLocaleString("es-AR")}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-400 tabular-nums">
                        {o.bultosTotal.toLocaleString("es-AR")}
                      </td>
                      <td className="px-3 py-2 text-right text-orange-400 tabular-nums">
                        {o.palletsTotal.toLocaleString("es-AR")}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{o.tareas}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs tabular-nums ${
                          o.eficiencia > 10 ? "text-emerald-400" : o.eficiencia > 5 ? "text-blue-400" : "text-zinc-400"
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
              <div className="p-8 text-center text-zinc-500">Sin datos de productividad para este día</div>
            )}
          </div>

          {/* Breakdown por Tarea */}
          {tareasData.length > 0 && (
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-700/50">
                <h3 className="text-sm font-medium text-zinc-300">Desglose por Tarea</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700/50 bg-zinc-800/50">
                      <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Tarea</th>
                      <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Usuarios</th>
                      <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Unidades</th>
                      <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Bultos</th>
                      <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tareasData.map((t) => (
                      <tr key={t.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-200">{t.name}</td>
                        <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{t.usuarios}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">
                          {t.unidades.toLocaleString("es-AR")}
                        </td>
                        <td className="px-3 py-2 text-right text-blue-400 tabular-nums">
                          {t.bultos.toLocaleString("es-AR")}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{formatTime(t.tiempo)}</td>
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
