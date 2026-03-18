import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import {
  saveKardexMes,
  type KardexMovimiento,
  type KardexArticuloResumen,
  type KardexDiaAgregado,
  type KardexMes,
} from "@/lib/kardex"
import { esMercaderia } from "@/lib/sku"

function excelDateToStr(val: unknown): string | null {
  if (val == null || val === "") return null
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
  }
  return String(val)
}

function num(val: unknown): number {
  if (val == null || val === "") return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function numOrNull(val: unknown): number | null {
  if (val == null || val === "") return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })

    // Row 0 = super-headers, Row 1 = column names, Row 2+ = data
    if (raw.length < 3) {
      return NextResponse.json({ error: "Archivo vacío o sin datos" }, { status: 400 })
    }

    // Parse movements
    const movimientos: KardexMovimiento[] = []

    for (let i = 2; i < raw.length; i++) {
      const r = raw[i] as unknown[]
      const codigo = String(r[0] ?? "").trim()
      if (!codigo || !esMercaderia(codigo)) continue

      const concepto = String(r[4] ?? "").trim()
      if (!concepto) continue

      const fecha = excelDateToStr(r[2])
      if (!fecha) continue

      movimientos.push({
        codigo,
        descripcion: String(r[1] ?? "").trim(),
        fecha,
        vctoLote: excelDateToStr(r[3]),
        concepto,
        tipo: String(r[5] ?? "").trim(),
        serie: String(r[6] ?? "").trim(),
        numero: String(r[7] ?? "").trim(),
        movBultos: num(r[8]),
        movUnids: num(r[9]),
        movPeso: num(r[10]),
        saldoCpp: num(r[11]),
        saldoImporte: num(r[12]),
        saldoBultos: num(r[13]),
        saldoUnids: num(r[14]),
        saldoPeso: num(r[15]),
        recuentoBultos: numOrNull(r[18]),
        recuentoUnids: numOrNull(r[19]),
        calcBultos: numOrNull(r[20]),
        calcUnids: numOrNull(r[21]),
      })
    }

    if (movimientos.length === 0) {
      return NextResponse.json({ error: "No se encontraron movimientos válidos" }, { status: 400 })
    }

    // Determine month from SALDO INICIAL or first movement
    const primerFecha = movimientos[0].fecha
    const mes = parseInt(primerFecha.slice(5, 7))
    const anio = parseInt(primerFecha.slice(0, 4))

    // ── Aggregate resumenArticulos ────────────────────────────
    const artMap = new Map<string, {
      desc: string
      saldoInicial: number
      saldoFinal: number
      lastFecha: string
      ingresos: number
      cargas: number
      descargas: number
      faltantes: number
      sobrantes: number
      devoluciones: number
      remitos: number
      envDepos: number
      remConsig: number
      recuentoBultos: number | null
      calcBultos: number | null
    }>()

    for (const m of movimientos) {
      let art = artMap.get(m.codigo)
      if (!art) {
        art = {
          desc: m.descripcion,
          saldoInicial: 0, saldoFinal: 0, lastFecha: "",
          ingresos: 0, cargas: 0, descargas: 0,
          faltantes: 0, sobrantes: 0, devoluciones: 0,
          remitos: 0, envDepos: 0, remConsig: 0,
          recuentoBultos: null, calcBultos: null,
        }
        artMap.set(m.codigo, art)
      }

      if (m.concepto === "SALDO INICIAL") {
        art.saldoInicial = m.saldoBultos
      }

      // Track last saldo
      if (m.fecha >= art.lastFecha && m.concepto !== "RECUENTO") {
        art.saldoFinal = m.saldoBultos
        art.lastFecha = m.fecha
      }

      // Sum by concepto
      const abs = Math.abs(m.movBultos)
      switch (m.concepto) {
        case "REC.DEPOS.": art.ingresos += m.movBultos; break
        case "CARGA": art.cargas += abs; break
        case "DESCARGA": art.descargas += m.movBultos; break
        case "FALTANTE": art.faltantes += abs; break
        case "SOBRANTE": art.sobrantes += m.movBultos; break
        case "DEVOLUCION": art.devoluciones += m.movBultos; break
        case "REMITO": art.remitos += abs; break
        case "ENV.DEPOS.": art.envDepos += abs; break
        case "REM.CONSIG.": art.remConsig += abs; break
        case "RECUENTO":
          art.recuentoBultos = m.recuentoBultos
          art.calcBultos = m.calcBultos
          break
      }
    }

    const resumenArticulos: KardexArticuloResumen[] = []
    for (const [codigo, a] of artMap) {
      resumenArticulos.push({
        codigo,
        descripcion: a.desc,
        saldoInicial: a.saldoInicial,
        saldoFinal: a.saldoFinal,
        totalIngresos: a.ingresos,
        totalCargas: a.cargas,
        totalDescargas: a.descargas,
        totalFaltantes: a.faltantes,
        totalSobrantes: a.sobrantes,
        totalDevoluciones: a.devoluciones,
        totalRemitos: a.remitos,
        totalEnvDepos: a.envDepos,
        totalRemConsig: a.remConsig,
        recuentoBultos: a.recuentoBultos,
        diferenciaRecuento: a.recuentoBultos != null && a.calcBultos != null
          ? a.recuentoBultos - a.calcBultos : null,
      })
    }
    resumenArticulos.sort((a, b) => b.totalCargas - a.totalCargas)

    // ── Aggregate evolucionDiaria ─────────────────────────────
    // For stockFinal: need last saldoBultos per article per day
    const fechas = [...new Set(movimientos.map(m => m.fecha))].sort()
    const artCodes = [...artMap.keys()]

    // Track last known saldo per article
    const lastSaldo = new Map<string, number>()
    for (const code of artCodes) {
      lastSaldo.set(code, artMap.get(code)!.saldoInicial)
    }

    const evolucionDiaria: KardexDiaAgregado[] = []

    for (const fecha of fechas) {
      const dayMovs = movimientos.filter(m => m.fecha === fecha)
      let ingresos = 0, cargas = 0, descargas = 0
      let faltantes = 0, sobrantes = 0, devoluciones = 0

      // Update saldos for articles that had movements this day
      const updatedArts = new Set<string>()
      for (const m of dayMovs) {
        if (m.concepto === "RECUENTO") continue
        lastSaldo.set(m.codigo, m.saldoBultos)
        updatedArts.add(m.codigo)

        const abs = Math.abs(m.movBultos)
        switch (m.concepto) {
          case "REC.DEPOS.": ingresos += m.movBultos; break
          case "CARGA": cargas += abs; break
          case "DESCARGA": descargas += m.movBultos; break
          case "FALTANTE": faltantes += abs; break
          case "SOBRANTE": sobrantes += m.movBultos; break
          case "DEVOLUCION": devoluciones += m.movBultos; break
        }
      }

      // Sum all articles' last known saldo
      let stockFinal = 0
      for (const s of lastSaldo.values()) stockFinal += s

      evolucionDiaria.push({
        fecha,
        stockFinal: Math.round(stockFinal * 100) / 100,
        ingresos: Math.round(ingresos * 100) / 100,
        cargas: Math.round(cargas * 100) / 100,
        descargas: Math.round(descargas * 100) / 100,
        faltantes: Math.round(faltantes * 100) / 100,
        sobrantes: Math.round(sobrantes * 100) / 100,
        devoluciones: Math.round(devoluciones * 100) / 100,
      })
    }

    // ── Totals ────────────────────────────────────────────────
    const totales = {
      stockInicial: resumenArticulos.reduce((s, a) => s + a.saldoInicial, 0),
      stockFinal: resumenArticulos.reduce((s, a) => s + a.saldoFinal, 0),
      ingresos: resumenArticulos.reduce((s, a) => s + a.totalIngresos, 0),
      cargas: resumenArticulos.reduce((s, a) => s + a.totalCargas, 0),
      descargas: resumenArticulos.reduce((s, a) => s + a.totalDescargas, 0),
      faltantes: resumenArticulos.reduce((s, a) => s + a.totalFaltantes, 0),
      sobrantes: resumenArticulos.reduce((s, a) => s + a.totalSobrantes, 0),
      devoluciones: resumenArticulos.reduce((s, a) => s + a.totalDevoluciones, 0),
    }

    const kardex: KardexMes = {
      mes,
      anio,
      movimientos,
      resumenArticulos,
      evolucionDiaria,
      totales,
      articulosCount: artMap.size,
      movimientosCount: movimientos.length,
      fechaDesde: fechas[0],
      fechaHasta: fechas[fechas.length - 1],
      uploadedAt: new Date().toISOString(),
    }

    saveKardexMes(kardex)

    return NextResponse.json({
      ok: true,
      mes,
      anio,
      articulos: kardex.articulosCount,
      movimientos: kardex.movimientosCount,
      fechaDesde: kardex.fechaDesde,
      fechaHasta: kardex.fechaHasta,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
