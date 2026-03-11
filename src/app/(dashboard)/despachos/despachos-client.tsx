"use client"

import { useEffect, useState } from "react"
import { getDespachosData, type DespachosData } from "@/actions/despachos"
import { KpiCard } from "@/components/kpi-card"
import { Truck, RefreshCw, Users, Package, MapPin } from "lucide-react"
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
    const interval = setInterval(load, 60_000) // refresh cada 1 min
    return () => clearInterval(interval)
  }, [])

  function handleFechaChange(f: string) {
    setFecha(f)
    load(f)
  }

  // Chart por hora
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" />
            Despachos
          </h1>
          <p className="text-sm text-zinc-400">Viajes y entregas del día</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Viajes"
              value={data.totales.viajes}
              icon={Truck}
              color="green"
            />
            <KpiCard
              title="Entregas"
              value={data.totales.entregas.toLocaleString("es-AR")}
              subtitle="puntos de entrega"
              icon={MapPin}
              color="blue"
            />
            <KpiCard
              title="Camiones"
              value={data.totales.camiones}
              subtitle="diferentes"
              icon={Truck}
              color="default"
            />
            <KpiCard
              title="Choferes"
              value={data.totales.choferes}
              icon={Users}
              color="default"
            />
          </div>

          {/* Chart de viajes por hora */}
          {horasData.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Salidas por Hora</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={horasData}>
                  <XAxis dataKey="hora" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                  />
                  <Bar dataKey="viajes" fill="#10b981" radius={[4, 4, 0, 0]} name="Viajes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-700/50">
              <h3 className="text-sm font-medium text-zinc-300">Detalle de Viajes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50 bg-zinc-800/50">
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Salida</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Nro Viaje</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Camión</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Chofer</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Ayudante</th>
                    <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Centro Op.</th>
                    <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">Entregas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.despachos.map((d, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-500 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums text-xs">{d.fechaHoraSalida}</td>
                      <td className="px-3 py-2 text-zinc-200 font-mono">{d.nroViaje}</td>
                      <td className="px-3 py-2 text-zinc-300">{d.camionFisico || d.camionSistema}</td>
                      <td className="px-3 py-2 text-zinc-200">{d.chofer}</td>
                      <td className="px-3 py-2 text-zinc-400">{d.ayudante || "-"}</td>
                      <td className="px-3 py-2 text-zinc-400">{d.centroOperativo}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 tabular-nums">
                          {d.entregas}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.despachos.length === 0 && (
              <div className="p-8 text-center text-zinc-500">Sin despachos registrados para este día</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
