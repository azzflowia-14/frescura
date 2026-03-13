"use client"

import { useEffect, useState, useMemo } from "react"
import { getCatalogoData, type CatalogoData } from "@/actions/catalogo"
import { KpiCard } from "@/components/kpi-card"
import { DivisionBadge } from "@/components/division-badge"
import { DivisionFilter } from "@/components/division-filter"
import { BookOpen, Tag, Award, Package, RefreshCw } from "lucide-react"
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
  Treemap,
} from "recharts"

const COLORS = [
  "#f59e0b", "#3b82f6", "#06b6d4", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#a855f7", "#e11d48", "#0ea5e9", "#d946ef",
  "#22c55e", "#eab308", "#2563eb", "#dc2626", "#7c3aed",
]

export function CatalogoClient() {
  const [data, setData] = useState<CatalogoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [divFilter, setDivFilter] = useState("TODAS")
  const [unFilter, setUnFilter] = useState("TODAS")

  useEffect(() => {
    getCatalogoData().then((d) => { setData(d); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.skus.filter((s) => {
      if (divFilter !== "TODAS" && s.division !== divFilter) return false
      if (unFilter !== "TODAS" && s.unidadNegocio !== unFilter) return false
      if (search) {
        const t = search.toLowerCase()
        return (
          s.articulo.toLowerCase().includes(t) ||
          s.descripcion.toLowerCase().includes(t) ||
          s.marca.toLowerCase().includes(t) ||
          s.familia.toLowerCase().includes(t)
        )
      }
      return true
    })
  }, [data, search, divFilter, unFilter])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando catálogo...
      </div>
    )
  }

  const { stats, indices } = data
  const top20Marcas = stats.porMarca.slice(0, 20)

  // Treemap data: divisiones
  const treemapData = stats.porDivision
    .filter((d) => d.division && d.division !== "NO APLICABLE")
    .map((d, i) => ({
      name: d.division,
      size: d.count,
      fill: COLORS[i % COLORS.length],
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Catálogo de Artículos</h1>
        <p className="text-sm text-slate-500">{stats.total.toLocaleString()} artículos en el maestro SKU</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total SKUs" value={stats.total.toLocaleString()} icon={BookOpen} color="blue" />
        <KpiCard title="Mercadería" value={stats.mercaderia.toLocaleString()} subtitle={`${stats.envases} envases`} icon={Package} color="green" />
        <KpiCard title="Marcas" value={stats.marcasUnicas.toLocaleString()} icon={Tag} color="orange" />
        <KpiCard title="Above Core" value={stats.aboveCore.toLocaleString()} icon={Award} color="yellow" />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Treemap by Division */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">SKUs por División</h3>
          <ResponsiveContainer width="100%" height={280}>
            <Treemap
              data={treemapData}
              dataKey="size"
              nameKey="name"
              stroke="#fff"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        </div>

        {/* Pie: Unidad de Negocio */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Distribución por Unidad de Negocio</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.porUnidadNegocio}
                dataKey="count"
                nameKey="unidadNegocio"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name} (${value})`}
                labelLine={false}
              >
                {stats.porUnidadNegocio.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 20 marcas bar chart */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Top 20 Marcas por Cantidad de SKUs</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={top20Marcas} layout="vertical" margin={{ left: 120 }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="marca" width={110} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" name="SKUs" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-600">Listado de Artículos</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar artículo, descripción, marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          <DivisionFilter value={divFilter} onChange={setDivFilter} divisiones={indices.divisiones} />
          <DivisionFilter value={unFilter} onChange={setUnFilter} divisiones={indices.unidadesNegocio} label="Unidad Negocio" />
        </div>

        <div className="text-xs text-slate-400">{filtered.length} artículos</div>

        <div className="overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="p-2">Art.</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">División</th>
                <th className="p-2">Marca</th>
                <th className="p-2">Familia</th>
                <th className="p-2">Calibre</th>
                <th className="p-2 text-right">UxB</th>
                <th className="p-2 text-right">HL/u</th>
                <th className="p-2">U. Negocio</th>
                <th className="p-2">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 200).map((s) => (
                <tr key={s.articulo} className="hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs">{s.articulo}</td>
                  <td className="p-2 max-w-[200px] truncate">{s.descripcion}</td>
                  <td className="p-2"><DivisionBadge division={s.division} /></td>
                  <td className="p-2 text-xs">{s.marca}</td>
                  <td className="p-2 text-xs">{s.familia}</td>
                  <td className="p-2 text-xs">{s.calibre}</td>
                  <td className="p-2 text-right font-mono text-xs">{s.unidadesPorBulto}</td>
                  <td className="p-2 text-right font-mono text-xs">{s.hlPorUnidad || "-"}</td>
                  <td className="p-2 text-xs">{s.unidadNegocio}</td>
                  <td className="p-2 text-xs">{s.tipoProducto}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="text-xs text-slate-400 p-2 text-center">
              Mostrando 200 de {filtered.length} — usá el buscador para filtrar
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Custom treemap content renderer
function TreemapContent(props: Record<string, unknown>) {
  const { x, y, width, height, name, fill } = props as {
    x: number; y: number; width: number; height: number; name: string; fill: string
  }
  if (width < 30 || height < 20) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 60 && height > 30 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" className="text-[10px] fill-white font-medium" style={{ pointerEvents: "none" }}>
          {name}
        </text>
      )}
    </g>
  )
}
