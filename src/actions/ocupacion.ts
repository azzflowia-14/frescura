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
  timestamp: string
  error?: string
}

export async function getOcupacionData(): Promise<OcupacionData> {
  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT *
      FROM dbo.OcupacionActualDeposito
    `)

    const detalle: UbicacionOcupada[] = rows.map((r) => ({
      cd: String(r["CD"] || r[Object.keys(r)[0]] || ""),
      cara: String(r["Cara"] || r[Object.keys(r)[1]] || ""),
      columna: String(r["Columna"] || r[Object.keys(r)[2]] || ""),
      nivel: String(r["Nivel"] || r[Object.keys(r)[3]] || ""),
      cantUbic: Number(r["Cant.Ubic"] || r["CantUbic"] || r[Object.keys(r)[4]] || 0),
      area: String(r["Area"] || r[Object.keys(r)[5]] || ""),
      articulo: String(r["Articulo"] || r[Object.keys(r)[6]] || ""),
      estado: String(r["Estado"] || r[Object.keys(r)[7]] || ""),
      inhibido: String(r["Inhibido"] || r[Object.keys(r)[8]] || ""),
    }))

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

      // Por cara
      if (!porCara[d.cara]) porCara[d.cara] = { ocupadas: 0, total: 0, porcentaje: 0 }
      porCara[d.cara].total++
      if (isOcupada) porCara[d.cara].ocupadas++

      // Por nivel
      if (!porNivel[d.nivel]) porNivel[d.nivel] = { ocupadas: 0, total: 0 }
      porNivel[d.nivel].total++
      if (isOcupada) porNivel[d.nivel].ocupadas++

      // Por área
      if (d.area) porArea[d.area] = (porArea[d.area] || 0) + 1

      // Por estado
      if (d.estado) porEstado[d.estado] = (porEstado[d.estado] || 0) + 1

      // Inhibidas
      if (d.inhibido === "SI" || d.inhibido === "S" || d.inhibido === "1" || d.inhibido === "true") {
        inhibidas++
      }
    }

    // Calcular porcentajes por cara
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
        detalle: detalle.slice(0, 500), // Limitar para performance
      },
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
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
