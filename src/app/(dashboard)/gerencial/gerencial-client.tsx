"use client"

import { useEffect, useState, useCallback } from "react"
import {
  getGerencialData,
  saveObjetivos,
  type GerencialData,
  type EspecialItem,
  type IngresoSkuItem,
  type SnapshotDiario,
} from "@/actions/gerencial"
import { KpiCard } from "@/components/kpi-card"
import { DivisionBadge } from "@/components/division-badge"
import {
  Beer,
  GlassWater,
  Droplets,
  CalendarDays,
  Target,
  RefreshCw,
  Save,
  TrendingUp,
} from "lucide-react"
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
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts"
import type { CategoriaEspecial } from "@/lib/sku"

const COLORS_CHART = [
  "#f59e0b", "#3b82f6", "#06b6d4", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
]

const SEMAFORO_COLORS = {
  verde: "bg-emerald-100 text-emerald-800",
  amarillo: "bg-amber-100 text-amber-800",
  rojo: "bg-red-100 text-red-800",
  "sin-datos": "bg-slate-100 text-slate-500",
}

const SEMAFORO_LABELS = {
  verde: "OK",
  amarillo: "Atención",
  rojo: "Crítico",
  "sin-datos": "S/D",
}

function fmtHl(n: number | null): string {
  if (n === null || n === undefined) return "-"
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function fmtDias(n: number | null): string {
  if (n === null) return "S/D"
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

type CatKey = "cervezas" | "aguas" | "ung"

export function GerencialClient() {
  const [data, setData] = useState<GerencialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stockModal, setStockModal] = useState<CatKey | null>(null)
  const [showObjModal, setShowObjModal] = useState(false)
  const [objCervezas, setObjCervezas] = useState("")
  const [objAguas, setObjAguas] = useState("")
  const [objUng, setObjUng] = useState("")
  const [selMes, setSelMes] = useState(new Date().getMonth() + 1)
  const [selAnio, setSelAnio] = useState(new Date().getFullYear())
  const [ingModal, setIngModal] = useState<CatKey | null>(null)
  const [marcaTipo, setMarcaTipo] = useState<CatKey>("cervezas")
  const [marcaSel, setMarcaSel] = useState<string>("")

  const load = useCallback(async (mes?: number, anio?: number) => {
    setLoading(true)
    try {
      const d = await getGerencialData(mes ?? selMes, anio ?? selAnio)
      setData(d)
      setObjCervezas(String(d.objetivos.cervezas || ""))
      setObjAguas(String(d.objetivos.aguas || ""))
      setObjUng(String(d.objetivos.ung || ""))
    } finally {
      setLoading(false)
    }
  }, [selMes, selAnio])

  useEffect(() => {
    load()
  }, [load])

  function handleMesChange(mes: number) {
    setSelMes(mes)
    load(mes, selAnio)
  }

  function handleAnioChange(anio: number) {
    setSelAnio(anio)
    load(selMes, anio)
  }

  async function handleSaveObj() {
    if (!data) return
    setSaving(true)
    try {
      await saveObjetivos(data.mes, data.anio, Number(objCervezas) || 0, Number(objAguas) || 0, Number(objUng) || 0)
      await load(data.mes, data.anio)
      setShowObjModal(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando informe gerencial...
      </div>
    )
  }

  const mesLabel = new Date(data.anio, data.mes - 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })

  // Progress bars data (ingresos vs objetivo)
  const progCervezas = data.objetivos.cervezas > 0
    ? Math.min(100, Math.round((data.ingresoCervezasHl / data.objetivos.cervezas) * 100))
    : 0
  const progAguas = data.objetivos.aguas > 0
    ? Math.min(100, Math.round((data.ingresoAguasHl / data.objetivos.aguas) * 100))
    : 0
  const progUng = data.objetivos.ung > 0
    ? Math.min(100, Math.round((data.ingresoUngHl / data.objetivos.ung) * 100))
    : 0

  // Pie data for stock by division (top 8)
  const pieData = data.stockPorDivision
    .filter((d) => d.division !== "NO APLICABLE" && d.hl > 0)
    .slice(0, 8)

  // Helper for ingreso modal
  function getIngresoTotal(cat: CatKey) {
    if (cat === "cervezas") return data!.ingresoCervezasHl
    if (cat === "aguas") return data!.ingresoAguasHl
    return data!.ingresoUngHl
  }
  function getProgreso(cat: CatKey) {
    if (cat === "cervezas") return progCervezas
    if (cat === "aguas") return progAguas
    return progUng
  }
  function getObjetivo(cat: CatKey) {
    if (cat === "cervezas") return data!.objetivos.cervezas
    if (cat === "aguas") return data!.objetivos.aguas
    return data!.objetivos.ung
  }
  const CAT_LABELS: Record<CatKey, string> = { cervezas: "Cervezas", aguas: "Aguas", ung: "UNG" }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Informe Gerencial</h1>
          <p className="text-sm text-slate-500 capitalize">{mesLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selMes}
            onChange={(e) => handleMesChange(Number(e.target.value))}
            disabled={loading}
            className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selAnio}
            onChange={(e) => handleAnioChange(Number(e.target.value))}
            disabled={loading}
            className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm"
          >
            {[2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* Fila 1: KPIs — 6 cards: stock + piso x 3 categorías */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => setStockModal("cervezas")} className="text-left">
          <KpiCard
            title="Stock Cervezas"
            value={`${fmtHl(data.stockCervezasHl)} HL`}
            subtitle="Click para detalle"
            icon={Beer}
            color="yellow"
          />
        </button>
        <button onClick={() => setStockModal("aguas")} className="text-left">
          <KpiCard
            title="Stock Aguas"
            value={`${fmtHl(data.stockAguasHl)} HL`}
            subtitle="Click para detalle"
            icon={Droplets}
            color="cyan"
          />
        </button>
        <button onClick={() => setStockModal("ung")} className="text-left">
          <KpiCard
            title="Stock UNG"
            value={`${fmtHl(data.stockUngHl)} HL`}
            subtitle="Click para detalle"
            icon={GlassWater}
            color="purple"
          />
        </button>
        <KpiCard
          title="Piso Cervezas"
          value={`${fmtDias(data.diasPisoCervezas)} días`}
          subtitle={`VPM: ${fmtHl(data.vpmCervezas)} HL/día`}
          icon={CalendarDays}
          color={data.diasPisoCervezas !== null && data.diasPisoCervezas < 10 ? "red" : "green"}
        />
        <KpiCard
          title="Piso Aguas"
          value={`${fmtDias(data.diasPisoAguas)} días`}
          subtitle={`VPM: ${fmtHl(data.vpmAguas)} HL/día`}
          icon={CalendarDays}
          color={data.diasPisoAguas !== null && data.diasPisoAguas < 10 ? "red" : "green"}
        />
        <KpiCard
          title="Piso UNG"
          value={`${fmtDias(data.diasPisoUng)} días`}
          subtitle={`VPM: ${fmtHl(data.vpmUng)} HL/día`}
          icon={CalendarDays}
          color={data.diasPisoUng !== null && data.diasPisoUng < 10 ? "red" : "green"}
        />
      </div>

      {/* Evolución diaria Días de Piso — 3 gráficos */}
      {data.snapshots.length >= 2 && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <Beer className="w-4 h-4 text-amber-500" /> Días de Piso — Cervezas
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data.snapshots}
                margin={{ left: 5, right: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(v) => {
                    const d = v.split("-")
                    return `${d[2]}/${d[1]}`
                  }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{ value: "Días", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const snap = payload[0].payload as SnapshotDiario
                    const d = String(label).split("-")
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                        <p className="font-medium text-slate-700">{d[2]}/{d[1]}/{d[0]}</p>
                        <p className="text-amber-600">Piso: <span className="font-semibold">{fmtDias(snap.diasPisoCervezas)} días</span></p>
                        <p className="text-slate-500">Stock: <span className="font-semibold">{fmtHl(snap.stockCervezasHl)} HL</span></p>
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  y={10}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: "Mín 10d", position: "right", fontSize: 9, fill: "#ef4444" }}
                />
                <Line
                  type="monotone"
                  dataKey="diasPisoCervezas"
                  name="Días de Piso"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-500" /> Días de Piso — Aguas
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data.snapshots}
                margin={{ left: 5, right: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(v) => {
                    const d = v.split("-")
                    return `${d[2]}/${d[1]}`
                  }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{ value: "Días", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const snap = payload[0].payload as SnapshotDiario
                    const d = String(label).split("-")
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                        <p className="font-medium text-slate-700">{d[2]}/{d[1]}/{d[0]}</p>
                        <p className="text-cyan-600">Piso: <span className="font-semibold">{fmtDias(snap.diasPisoAguas)} días</span></p>
                        <p className="text-slate-500">Stock: <span className="font-semibold">{fmtHl(snap.stockAguasHl)} HL</span></p>
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  y={10}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: "Mín 10d", position: "right", fontSize: 9, fill: "#ef4444" }}
                />
                <Line
                  type="monotone"
                  dataKey="diasPisoAguas"
                  name="Días de Piso"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#06b6d4", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#06b6d4", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <GlassWater className="w-4 h-4 text-violet-500" /> Días de Piso — UNG
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data.snapshots}
                margin={{ left: 5, right: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(v) => {
                    const d = v.split("-")
                    return `${d[2]}/${d[1]}`
                  }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{ value: "Días", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const snap = payload[0].payload as SnapshotDiario
                    const d = String(label).split("-")
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                        <p className="font-medium text-slate-700">{d[2]}/{d[1]}/{d[0]}</p>
                        <p className="text-violet-600">Piso: <span className="font-semibold">{fmtDias(snap.diasPisoUng)} días</span></p>
                        <p className="text-slate-500">Stock: <span className="font-semibold">{fmtHl(snap.stockUngHl)} HL</span></p>
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  y={10}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: "Mín 10d", position: "right", fontSize: 9, fill: "#ef4444" }}
                />
                <Line
                  type="monotone"
                  dataKey="diasPisoUng"
                  name="Días de Piso"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.snapshots.length < 2 && data.snapshots.length > 0 && (
        <div className="bg-white rounded-xl border p-4 text-center text-sm text-slate-400">
          Evolución diaria: {data.snapshots.length} dato registrado. El gráfico aparece a partir de 2 días de datos.
        </div>
      )}

      {/* Fila 2: Objetivos — 3 barras */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Target className="w-4 h-4" /> Cumplimiento de Objetivos
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {data.diasHabilesRestantes} días hábiles restantes
            </span>
            <button
              onClick={() => setShowObjModal(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              Editar objetivos
            </button>
          </div>
        </div>

        {data.objetivos.cervezas === 0 && data.objetivos.aguas === 0 && data.objetivos.ung === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 mb-2">No hay objetivos cargados para este mes</p>
            <button
              onClick={() => setShowObjModal(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Cargar objetivos
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button className="w-full text-left" onClick={() => setIngModal("cervezas")}>
              <ProgressRow
                label="Cervezas"
                current={data.ingresoCervezasHl}
                target={data.objetivos.cervezas}
                percent={progCervezas}
                color="amber"
                clickable
              />
            </button>
            <button className="w-full text-left" onClick={() => setIngModal("aguas")}>
              <ProgressRow
                label="Aguas"
                current={data.ingresoAguasHl}
                target={data.objetivos.aguas}
                percent={progAguas}
                color="cyan"
                clickable
              />
            </button>
            <button className="w-full text-left" onClick={() => setIngModal("ung")}>
              <ProgressRow
                label="UNG"
                current={data.ingresoUngHl}
                target={data.objetivos.ung}
                percent={progUng}
                color="violet"
                clickable
              />
            </button>
          </div>
        )}
      </div>

      {/* Modal Objetivos */}
      {showObjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">Objetivos {mesLabel}</h3>
            <p className="text-xs text-slate-400">
              Ingresá el objetivo de retiro mensual en hectolitros
            </p>
            <div>
              <label className="text-sm text-slate-600">Cervezas (HL)</label>
              <input
                type="number"
                value={objCervezas}
                onChange={(e) => setObjCervezas(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm mt-1"
                placeholder="Ej: 12000"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Aguas (HL)</label>
              <input
                type="number"
                value={objAguas}
                onChange={(e) => setObjAguas(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm mt-1"
                placeholder="Ej: 3000"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">UNG (HL)</label>
              <input
                type="number"
                value={objUng}
                onChange={(e) => setObjUng(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm mt-1"
                placeholder="Ej: 2000"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowObjModal(false)}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveObj}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fila 3: Ingresos acumulados del mes — 3 líneas */}
      {data.ingresos.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">
            Ingresos Acumulados — {mesLabel}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.ingresos} margin={{ left: 10, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(v) => { const d = v.split("-"); return `${d[2]}/${d[1]}` }}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(v) => { const d = String(v).split("-"); return `${d[2]}/${d[1]}/${d[0]}` }}
              />
              <Legend />
              <Line type="monotone" dataKey="acumCervezas" name="Cervezas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="acumAguas" name="Aguas" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="acumUng" name="UNG" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              {data.objetivos.cervezas > 0 && (
                <ReferenceLine y={data.objetivos.cervezas} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `Obj Cerv: ${fmtHl(data.objetivos.cervezas)}`, position: "right", fontSize: 10 }} />
              )}
              {data.objetivos.aguas > 0 && (
                <ReferenceLine y={data.objetivos.aguas} stroke="#06b6d4" strokeDasharray="5 5" label={{ value: `Obj Aguas: ${fmtHl(data.objetivos.aguas)}`, position: "right", fontSize: 10 }} />
              )}
              {data.objetivos.ung > 0 && (
                <ReferenceLine y={data.objetivos.ung} stroke="#8b5cf6" strokeDasharray="5 5" label={{ value: `Obj UNG: ${fmtHl(data.objetivos.ung)}`, position: "right", fontSize: 10 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fila 4: Stock por División */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Stock por División (HL)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="hl"
                nameKey="division"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${fmtHl(value as number)}`}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${fmtHl(v as number)} HL`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Top Divisiones (HL)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.stockPorDivision.filter((d) => d.hl > 0).slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" tickFormatter={(v) => fmtHl(v)} />
              <YAxis type="category" dataKey="division" width={90} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${fmtHl(v as number)} HL`} />
              <Bar dataKey="hl" name="HL" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle por Marca — Torta SKUs */}
      <StockPorMarca
        stockItems={data.stockItems}
        tipo={marcaTipo}
        marcaSel={marcaSel}
        onTipoChange={(t) => { setMarcaTipo(t); setMarcaSel("") }}
        onMarcaChange={setMarcaSel}
      />

      {/* Fila 4: Productos Especiales */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <h3 className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Productos Especiales — VPD 7 días
        </h3>

        {(Object.entries(data.especiales) as [CategoriaEspecial, typeof data.especiales[CategoriaEspecial]][]).map(
          ([cat, { label, items, totalHl }]) => {
            if (items.length === 0) return null
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
                  <span className="text-xs text-slate-400">Stock total: {fmtHl(totalHl)} HL</span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase border-b">
                        <th className="p-1.5">Art.</th>
                        <th className="p-1.5">Descripción</th>
                        <th className="p-1.5 text-right">Stock HL</th>
                        <th className="p-1.5 text-right">VPD 7d HL</th>
                        <th className="p-1.5 text-right">Cobertura</th>
                        <th className="p-1.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <EspecialRow key={item.articulo} item={item} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        )}
      </div>

      {/* Fila 5: Top SKUs por stock HL */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Top 20 SKUs por Stock (HL)</h3>
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="p-2">Art.</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">División</th>
                <th className="p-2">Marca</th>
                <th className="p-2 text-right">Bultos</th>
                <th className="p-2 text-right">HL</th>
                <th className="p-2">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.stockItems
                .sort((a, b) => b.hl - a.hl)
                .slice(0, 20)
                .map((s) => (
                  <tr key={s.articulo} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{s.articulo}</td>
                    <td className="p-2 max-w-[200px] truncate">{s.descripcion}</td>
                    <td className="p-2"><DivisionBadge division={s.division} /></td>
                    <td className="p-2 text-xs">{s.marca}</td>
                    <td className="p-2 text-right font-mono text-xs">{s.bultos.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-xs font-semibold">{fmtHl(s.hl)}</td>
                    <td className="p-2">
                      <ClasifBadge clasif={s.clasificacion} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-300 text-right">
        Actualizado: {new Date(data.timestamp).toLocaleString("es-AR")}
      </p>

      {/* Modal detalle stock por SKU */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStockModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Stock {CAT_LABELS[stockModal]} — Detalle por SKU
              </h3>
              <button onClick={() => setStockModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <th className="p-2">Art.</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Bultos</th>
                    <th className="p-2 text-right">HL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.stockItems
                    .filter((s) => s.clasificacion === stockModal)
                    .sort((a, b) => b.hl - a.hl)
                    .map((s) => (
                      <tr key={s.articulo} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-xs">{s.articulo}</td>
                        <td className="p-2 max-w-[250px] truncate">{s.descripcion}</td>
                        <td className="p-2 text-right font-mono text-xs">{s.bultos.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-xs font-semibold">{fmtHl(s.hl)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <td className="p-2" colSpan={2}>TOTAL</td>
                    <td className="p-2 text-right font-mono text-xs">
                      {data.stockItems.filter((s) => s.clasificacion === stockModal).reduce((sum, s) => sum + s.bultos, 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono text-xs">
                      {fmtHl(
                        stockModal === "cervezas" ? data.stockCervezasHl
                          : stockModal === "aguas" ? data.stockAguasHl
                          : data.stockUngHl
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle ingresos por SKU (cumplimiento) */}
      {ingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setIngModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Ingresos {CAT_LABELS[ingModal]} — {mesLabel}
                </h3>
                <p className="text-xs text-slate-400">
                  Detalle por SKU · {fmtHl(getIngresoTotal(ingModal))} HL totales
                  {getObjetivo(ingModal) > 0 && ` · ${getProgreso(ingModal)}% del objetivo`}
                </p>
              </div>
              <button onClick={() => setIngModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <th className="p-2">#</th>
                    <th className="p-2">Art.</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Bultos</th>
                    <th className="p-2 text-right">HL</th>
                    <th className="p-2 text-right">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.ingresosPorSku
                    .filter((s) => s.clasificacion === ingModal)
                    .map((s, i) => {
                      const totalHl = getIngresoTotal(ingModal!)
                      const pct = totalHl > 0 ? Math.round((s.hl / totalHl) * 1000) / 10 : 0
                      return (
                        <tr key={s.articulo} className="hover:bg-slate-50">
                          <td className="p-2 text-xs text-slate-400">{i + 1}</td>
                          <td className="p-2 font-mono text-xs">{s.articulo}</td>
                          <td className="p-2 max-w-[250px] truncate">{s.descripcion}</td>
                          <td className="p-2 text-right font-mono text-xs">{s.bultos.toLocaleString("es-AR")}</td>
                          <td className="p-2 text-right font-mono text-xs font-semibold">{fmtHl(s.hl)}</td>
                          <td className="p-2 text-right text-xs text-slate-500">{pct}%</td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <td className="p-2" colSpan={3}>TOTAL</td>
                    <td className="p-2 text-right font-mono text-xs">
                      {data.ingresosPorSku
                        .filter((s) => s.clasificacion === ingModal)
                        .reduce((sum, s) => sum + s.bultos, 0)
                        .toLocaleString("es-AR")}
                    </td>
                    <td className="p-2 text-right font-mono text-xs">
                      {fmtHl(getIngresoTotal(ingModal!))}
                    </td>
                    <td className="p-2 text-right text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClasifBadge({ clasif }: { clasif: string }) {
  const styles: Record<string, string> = {
    cervezas: "bg-amber-100 text-amber-700",
    aguas: "bg-cyan-100 text-cyan-700",
    ung: "bg-violet-100 text-violet-700",
    otro: "bg-slate-100 text-slate-500",
  }
  const labels: Record<string, string> = {
    cervezas: "Cervezas",
    aguas: "Aguas",
    ung: "UNG",
    otro: "Otro",
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[clasif] || styles.otro}`}>
      {labels[clasif] || clasif}
    </span>
  )
}

function ProgressRow({
  label,
  current,
  target,
  percent,
  color,
  clickable,
}: {
  label: string
  current: number
  target: number
  percent: number
  color: "amber" | "cyan" | "violet"
  clickable?: boolean
}) {
  const bgMap = { amber: "bg-amber-500", cyan: "bg-cyan-500", violet: "bg-violet-500" }
  const trackMap = { amber: "bg-amber-100", cyan: "bg-cyan-100", violet: "bg-violet-100" }
  return (
    <div className={`space-y-1 ${clickable ? "hover:bg-slate-50 rounded-lg p-1.5 -m-1.5 transition-colors cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {label}
          {clickable && <span className="text-[10px] text-slate-400 ml-1.5">click para detalle</span>}
        </span>
        <span className="text-xs text-slate-400">
          {fmtHl(current)} / {fmtHl(target)} HL ({percent}%)
        </span>
      </div>
      <div className={`h-3 rounded-full ${trackMap[color]} overflow-hidden`}>
        <div className={`h-full rounded-full ${bgMap[color]} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function StockPorMarca({
  stockItems,
  tipo,
  marcaSel,
  onTipoChange,
  onMarcaChange,
}: {
  stockItems: GerencialData["stockItems"]
  tipo: CatKey
  marcaSel: string
  onTipoChange: (t: CatKey) => void
  onMarcaChange: (m: string) => void
}) {
  // Get items for selected tipo
  const items = stockItems.filter((s) => s.clasificacion === tipo && s.hl > 0)

  // Get unique marcas sorted by total HL
  const marcaHl = new Map<string, number>()
  for (const s of items) {
    const m = s.marca || "Sin marca"
    marcaHl.set(m, (marcaHl.get(m) || 0) + s.hl)
  }
  const marcas = Array.from(marcaHl.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)

  // Auto-select first marca if none selected
  const marca = marcaSel || marcas[0] || ""

  // SKUs for selected marca
  const skus = items
    .filter((s) => (s.marca || "Sin marca") === marca)
    .sort((a, b) => b.hl - a.hl)

  const totalHlMarca = skus.reduce((sum, s) => sum + s.hl, 0)
  const totalVpdMarca = skus.reduce((sum, s) => sum + s.vpd7Hl, 0)
  const pisoMarca = totalVpdMarca > 0 ? Math.round((totalHlMarca / totalVpdMarca) * 10) / 10 : null

  const BTN_STYLES: Record<CatKey, string> = {
    cervezas: "bg-amber-500 text-white",
    aguas: "bg-cyan-500 text-white",
    ung: "bg-violet-500 text-white",
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-sm font-medium text-slate-600">
          Stock por Marca / SKU (HL)
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(["cervezas", "aguas", "ung"] as CatKey[]).map((t) => (
              <button
                key={t}
                onClick={() => onTipoChange(t)}
                className={`px-3 py-1.5 transition-colors ${tipo === t ? BTN_STYLES[t] : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {t === "cervezas" ? "Cervezas" : t === "aguas" ? "Aguas" : "UNG"}
              </button>
            ))}
          </div>
          <select
            value={marca}
            onChange={(e) => onMarcaChange(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm max-w-[200px]"
          >
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m} ({fmtHl(marcaHl.get(m) || 0)} HL)
              </option>
            ))}
          </select>
        </div>
      </div>

      {skus.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Sin datos para esta marca</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pie chart */}
          <div>
            <div className="text-center mb-2 space-y-0.5">
              <div>
                <span className="text-lg font-bold text-slate-800">{marca}</span>
                <span className="text-sm text-slate-400 ml-2">{fmtHl(totalHlMarca)} HL</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-xs">
                <span className="text-slate-500">VPD 7d: <span className="font-semibold text-slate-700">{fmtHl(totalVpdMarca)} HL/día</span></span>
                <span className={`font-semibold ${pisoMarca !== null && pisoMarca < 10 ? "text-red-600" : "text-emerald-600"}`}>
                  Piso: {pisoMarca !== null ? `${fmtDias(pisoMarca)} días` : "S/D"}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={skus.map((s) => ({ name: s.descripcion, hl: Math.round(s.hl * 100) / 100 }))}
                  dataKey="hl"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => {
                    const short = String(name).length > 25 ? String(name).slice(0, 25) + "..." : name
                    return `${short}: ${fmtHl(value as number)}`
                  }}
                  labelLine={false}
                >
                  {skus.map((_, i) => (
                    <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${fmtHl(v as number)} HL`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs text-slate-500 uppercase border-b">
                  <th className="p-1.5">Art.</th>
                  <th className="p-1.5">Descripción</th>
                  <th className="p-1.5 text-right">HL</th>
                  <th className="p-1.5 text-right">VPD 7d</th>
                  <th className="p-1.5 text-right">Piso</th>
                  <th className="p-1.5 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {skus.map((s, i) => {
                  const pct = totalHlMarca > 0 ? Math.round((s.hl / totalHlMarca) * 1000) / 10 : 0
                  return (
                    <tr key={s.articulo} className="hover:bg-slate-50">
                      <td className="p-1.5 font-mono text-xs">{s.articulo}</td>
                      <td className="p-1.5 text-xs max-w-[180px] truncate flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: COLORS_CHART[i % COLORS_CHART.length] }}
                        />
                        {s.descripcion}
                      </td>
                      <td className="p-1.5 text-right font-mono text-xs font-semibold">{fmtHl(s.hl)}</td>
                      <td className="p-1.5 text-right font-mono text-xs">{fmtHl(s.vpd7Hl)}</td>
                      <td className={`p-1.5 text-right font-mono text-xs font-semibold ${s.diasPiso !== null && s.diasPiso < 10 ? "text-red-600" : "text-emerald-600"}`}>
                        {s.diasPiso !== null ? `${fmtDias(s.diasPiso)}d` : "-"}
                      </td>
                      <td className="p-1.5 text-right text-xs text-slate-500">{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td className="p-1.5" colSpan={2}>TOTAL</td>
                  <td className="p-1.5 text-right font-mono text-xs">{fmtHl(totalHlMarca)}</td>
                  <td className="p-1.5 text-right font-mono text-xs">{fmtHl(totalVpdMarca)}</td>
                  <td className={`p-1.5 text-right font-mono text-xs font-semibold ${pisoMarca !== null && pisoMarca < 10 ? "text-red-600" : "text-emerald-600"}`}>
                    {pisoMarca !== null ? `${fmtDias(pisoMarca)}d` : "-"}
                  </td>
                  <td className="p-1.5 text-right text-xs">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function EspecialRow({ item }: { item: EspecialItem }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="p-1.5 font-mono text-xs">{item.articulo}</td>
      <td className="p-1.5 text-xs max-w-[180px] truncate">{item.descripcion}</td>
      <td className="p-1.5 text-right font-mono text-xs">{fmtHl(item.stockHl)}</td>
      <td className="p-1.5 text-right font-mono text-xs">{fmtHl(item.vpd7Hl)}</td>
      <td className="p-1.5 text-right font-mono text-xs">
        {item.diasCobertura !== null ? `${fmtDias(item.diasCobertura)} d` : "-"}
      </td>
      <td className="p-1.5 text-center">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${SEMAFORO_COLORS[item.semaforo]}`}>
          {SEMAFORO_LABELS[item.semaforo]}
        </span>
      </td>
    </tr>
  )
}
