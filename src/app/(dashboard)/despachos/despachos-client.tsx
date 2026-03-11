"use client"

import { useEffect, useState } from "react"
import { getDespachosData, type DespachosData } from "@/actions/despachos"
import { KpiCard } from "@/components/kpi-card"
import { Truck, RefreshCw, Users, MapPin } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export function DespachosClient() {
  const [data, setData] = useState<DespachosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])

  async function load(f?: string) {
    setLoading(true)
    try {
      const result = await getDespachosData(f || fecha)
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  function handleFechaChange(f: string) {
    setFecha(f)
    load(f)
  }

  const horasData = data
    ? Object.entries(data.porHora)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hora, viajes]) => ({ hora, viajes }))
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-500" />
            Despachos
          </h1>
          <p className="text-sm text-slate-400">Viajes y entregas del día</p>
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
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Viajes" value={data.totales.viajes} icon={Truck} color="green" />
            <KpiCard title="Entregas" value={data.totales.entregas.toLocaleString("es-AR")} subtitle="puntos de entrega" icon={MapPin} color="blue" />
            <KpiCard title="Camiones" value={data.totales.camiones} subtitle="diferentes" icon={Truck} color="default" />
            <KpiCard title="Choferes" value={data.totales.choferes} icon={Users} color="default" />
          </div>

          {/* Chart */}
          {horasData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Salidas por Hora</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={horasData}>
                  <XAxis dataKey="hora" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#334155" }} />
                  <Bar dataKey="viajes" fill="#10b981" radius={[6, 6, 0, 0]} name="Viajes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-600">Detalle de Viajes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">#</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Salida</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Nro Viaje</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Camión</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Chofer</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Ayudante</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Centro Op.</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold">Entregas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.despachos.map((d, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-600 tabular-nums text-xs">{d.fechaHoraSalida}</td>
                      <td className="px-4 py-2.5 text-slate-800 font-mono font-medium">{d.nroViaje}</td>
                      <td className="px-4 py-2.5 text-slate-600">{d.camionFisico || d.camionSistema}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{d.chofer}</td>
                      <td className="px-4 py-2.5 text-slate-500">{d.ayudante || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{d.centroOperativo}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 tabular-nums">
                          {d.entregas}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.despachos.length === 0 && (
              <div className="p-8 text-center text-slate-400">Sin despachos registrados para este día</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
