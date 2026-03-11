"use client"

import { useEffect, useState } from "react"
import { getDashboardKpis, type DashboardKpis } from "@/actions/dashboard-kpis"
import { KpiCard } from "@/components/kpi-card"
import {
  Package,
  AlertTriangle,
  Timer,
  Truck,
  Users,
  Warehouse,
  ShieldAlert,
  UserX,
  RefreshCw,
  PackageX,
} from "lucide-react"

export function DashboardClient() {
  const [data, setData] = useState<DashboardKpis | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const result = await getDashboardKpis()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 120_000) // refresh each 2 min
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard WMS</h1>
          <p className="text-sm text-zinc-400">
            Vista general en tiempo real — {data?.timestamp ? new Date(data.timestamp).toLocaleString("es-AR") : "Cargando..."}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Errores */}
      {data?.errors && data.errors.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-lg p-3">
          <p className="text-xs text-yellow-400 font-medium">Algunas fuentes no respondieron:</p>
          {data.errors.map((e, i) => (
            <p key={i} className="text-xs text-yellow-500/70 mt-0.5">{e}</p>
          ))}
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* Section: Stock & Frescura */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Stock & Frescura</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard
                title="SKUs en Stock"
                value={data.skusEnStock.toLocaleString("es-AR")}
                icon={Package}
                color="blue"
              />
              <KpiCard
                title="Unidades Totales"
                value={data.unidadesTotales.toLocaleString("es-AR")}
                icon={Package}
                color="default"
              />
              <KpiCard
                title="Vencidos"
                value={data.productosVencidos}
                subtitle="productos vencidos"
                icon={Timer}
                color="red"
              />
              <KpiCard
                title="Críticos (0-15d)"
                value={data.productosCriticos}
                subtitle="próximos a vencer"
                icon={AlertTriangle}
                color="orange"
              />
              <KpiCard
                title="Urgentes (16-30d)"
                value={data.productosUrgentes}
                icon={AlertTriangle}
                color="yellow"
              />
            </div>
          </div>

          {/* Section: Operaciones del día */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Operaciones Hoy</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard
                title="Despachos"
                value={data.despachosHoy}
                subtitle="viajes salieron"
                icon={Truck}
                color="green"
              />
              <KpiCard
                title="Entregas"
                value={data.entregasHoy.toLocaleString("es-AR")}
                subtitle="entregas programadas"
                icon={Truck}
                color="green"
              />
              <KpiCard
                title="Operarios"
                value={data.operariosActivos}
                subtitle="activos hoy"
                icon={Users}
                color="blue"
              />
              <KpiCard
                title="Unidades Movidas"
                value={data.unidadesMovidas.toLocaleString("es-AR")}
                subtitle="producción del día"
                icon={Package}
                color="blue"
              />
              <KpiCard
                title="FEFO Vulnerado"
                value={data.fefoViolaciones}
                subtitle="violaciones activas"
                icon={ShieldAlert}
                color={data.fefoViolaciones > 0 ? "red" : "green"}
              />
            </div>
          </div>

          {/* Section: Depósito */}
          <div>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Depósito</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                title="Ocupación"
                value={`${data.porcentajeOcupacion}%`}
                subtitle={`${data.ubicacionesOcupadas.toLocaleString("es-AR")} / ${data.ubicacionesTotales.toLocaleString("es-AR")} ubicaciones`}
                icon={Warehouse}
                color={data.porcentajeOcupacion > 90 ? "red" : data.porcentajeOcupacion > 75 ? "orange" : "green"}
              />
              <KpiCard
                title="Ubicaciones Libres"
                value={(data.ubicacionesTotales - data.ubicacionesOcupadas).toLocaleString("es-AR")}
                icon={Warehouse}
                color="default"
              />
              <KpiCard
                title="Sin Stock"
                value={data.articulosSinStock}
                subtitle="artículos en quiebre"
                icon={PackageX}
                color={data.articulosSinStock > 0 ? "orange" : "green"}
              />
              <KpiCard
                title="Clientes Afuera"
                value={data.clientesAfuera}
                subtitle="no se despachan hoy"
                icon={UserX}
                color={data.clientesAfuera > 0 ? "yellow" : "green"}
              />
            </div>
          </div>

          {/* Ocupación visual bar */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-300 font-medium">Ocupación del Depósito</span>
              <span className="text-sm text-zinc-400 tabular-nums">{data.porcentajeOcupacion}%</span>
            </div>
            <div className="w-full h-4 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  data.porcentajeOcupacion > 90
                    ? "bg-red-500"
                    : data.porcentajeOcupacion > 75
                    ? "bg-orange-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${data.porcentajeOcupacion}%` }}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((section) => (
        <div key={section}>
          <div className="h-3 w-32 bg-zinc-800 rounded mb-3 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
