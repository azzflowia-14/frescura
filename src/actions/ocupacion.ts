"use server"

import { query } from "@/lib/db"

export interface UbicacionOcupada {
  cd: string
  cara: string
  columna: string
  nivel: string
  cantUbic: number
  area: string
  articulo: string
  estado: string
  inhibido: string
}

export interface OcupacionResumen {
  totalUbicaciones: number
  ocupadas: number
  libres: number
  porcentajeOcupacion: number
  porCara: Record<string, { ocupadas: number; total: number; porcentaje: number }>
  porNivel: Record<string, { ocupadas: number; total: number }>
  porArea: Record<string, number>
  porEstado: Record<string, number>
  inhibidas: number
  detalle: UbicacionOcupada[]
}

export interface OcupacionData {
  resumen: OcupacionResumen
  cdsDisponibles: string[]
  cdSeleccionado: string
  timestamp: string
  error?: string
}

export async function getOcupacionData(cd?: string): Promise<OcupacionData> {
  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT *
      FROM dbo.OcupacionActualDeposito
    `)

    const allDetalle: UbicacionOcupada[] = rows.map((r) => ({
      cd: String(r["CD"] || r[Object.keys(r)[0]] || "").trim(),
      cara: String(r["Cara"] || r[Object.keys(r)[1]] || "").trim(),
      columna: String(r["Columna"] || r[Object.keys(r)[2]] || "").trim(),
      nivel: String(r["Nivel"] || r[Object.keys(r)[3]] || "").trim(),
      cantUbic: Number(r["Cant.Ubic"] || r["CantUbic"] || r[Object.keys(r)[4]] || 0),
      area: String(r["Area"] || r[Object.keys(r)[5]] || "").trim(),
      articulo: String(r["Articulo"] || r[Object.keys(r)[6]] || "").trim(),
      estado: String(r["Estado"] || r[Object.keys(r)[7]] || "").trim(),
      inhibido: String(r["Inhibido"] || r[Object.keys(r)[8]] || "").trim(),
    }))

    // Obtener CDs únicos
    const cdsSet = new Set(allDetalle.map((d) => d.cd).filter(Boolean))
    const cdsDisponibles = Array.from(cdsSet).sort()

    // Filtrar por CD si se seleccionó uno
    const detalle = cd && cd !== "TODOS" ? allDetalle.filter((d) => d.cd === cd) : allDetalle

    const ocupadas = detalle.filter((d) => d.articulo && d.articulo !== "" && d.articulo !== "null").length
    const totalUbicaciones = detalle.length
    const libres = totalUbicaciones - ocupadas

    const porCara: Record<string, { ocupadas: number; total: number; porcentaje: number }> = {}
    const porNivel: Record<string, { ocupadas: number; total: number }> = {}
    const porArea: Record<string, number> = {}
    const porEstado: Record<string, number> = {}
    let inhibidas = 0

    for (const d of detalle) {
      const isOcupada = d.articulo && d.articulo !== "" && d.articulo !== "null"

      if (!porCara[d.cara]) porCara[d.cara] = { ocupadas: 0, total: 0, porcentaje: 0 }
      porCara[d.cara].total++
      if (isOcupada) porCara[d.cara].ocupadas++

      if (!porNivel[d.nivel]) porNivel[d.nivel] = { ocupadas: 0, total: 0 }
      porNivel[d.nivel].total++
      if (isOcupada) porNivel[d.nivel].ocupadas++

      if (d.area) porArea[d.area] = (porArea[d.area] || 0) + 1
      if (d.estado) porEstado[d.estado] = (porEstado[d.estado] || 0) + 1

      if (d.inhibido === "SI" || d.inhibido === "S" || d.inhibido === "1" || d.inhibido === "true") {
        inhibidas++
      }
    }

    for (const cara of Object.values(porCara)) {
      cara.porcentaje = cara.total > 0 ? Math.round((cara.ocupadas / cara.total) * 100) : 0
    }

    return {
      resumen: {
        totalUbicaciones,
        ocupadas,
        libres,
        porcentajeOcupacion: totalUbicaciones > 0 ? Math.round((ocupadas / totalUbicaciones) * 100) : 0,
        porCara,
        porNivel,
        porArea,
        porEstado,
        inhibidas,
        detalle: detalle.slice(0, 500),
      },
      cdsDisponibles,
      cdSeleccionado: cd || "TODOS",
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return {
      resumen: {
        totalUbicaciones: 0,
        ocupadas: 0,
        libres: 0,
        porcentajeOcupacion: 0,
        porCara: {},
        porNivel: {},
        porArea: {},
        porEstado: {},
        inhibidas: 0,
        detalle: [],
      },
      cdsDisponibles: [],
      cdSeleccionado: cd || "TODOS",
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
