"use server"

import { query } from "@/lib/db"

export interface Despacho {
  fechaHoraSalida: string
  nroViaje: string
  camionSistema: string
  camionFisico: string
  chofer: string
  ayudante: string
  centroOperativo: string
  entregas: number
}

export interface DespachosData {
  despachos: Despacho[]
  totales: {
    viajes: number
    entregas: number
    camiones: number
    choferes: number
  }
  porHora: Record<string, number>
  timestamp: string
  error?: string
}

export async function getDespachosData(fecha?: string): Promise<DespachosData> {
  const fechaQuery = fecha || new Date().toISOString().split("T")[0]

  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT *
      FROM dbo.Vista_Orden_de_Salida
      WHERE CONVERT(date, FechaHoraSalida) = @fecha
      ORDER BY FechaHoraSalida DESC
    `, { fecha: fechaQuery })

    const despachos: Despacho[] = rows.map((r) => {
      const fechaRaw = r["FechaHoraSalida"]
      let fechaStr = ""
      if (fechaRaw instanceof Date) {
        fechaStr = fechaRaw.toLocaleString("es-AR")
      } else {
        fechaStr = String(fechaRaw || "")
      }

      return {
        fechaHoraSalida: fechaStr,
        nroViaje: String(r["NroViaje"] || r["Nro Viaje"] || ""),
        camionSistema: String(r["Camion Sist"] || r["CamionSist"] || r["CamionSistema"] || ""),
        camionFisico: String(r["Camion Fisico"] || r["CamionFisico"] || ""),
        chofer: String(r["Chofer"] || ""),
        ayudante: String(r["Ayudante"] || ""),
        centroOperativo: String(r["CentroOperativo"] || r["Centro Operativo"] || ""),
        entregas: Number(r["Entregas"] || 0),
      }
    })

    const camiones = new Set(despachos.map((d) => d.camionFisico || d.camionSistema).filter(Boolean))
    const choferes = new Set(despachos.map((d) => d.chofer).filter(Boolean))

    // Agrupar por hora
    const porHora: Record<string, number> = {}
    for (const d of despachos) {
      const match = d.fechaHoraSalida.match(/(\d{1,2}):\d{2}/)
      if (match) {
        const hora = match[1].padStart(2, "0") + ":00"
        porHora[hora] = (porHora[hora] || 0) + 1
      }
    }

    return {
      despachos,
      totales: {
        viajes: despachos.length,
        entregas: despachos.reduce((s, d) => s + d.entregas, 0),
        camiones: camiones.size,
        choferes: choferes.size,
      },
      porHora,
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return {
      despachos: [],
      totales: { viajes: 0, entregas: 0, camiones: 0, choferes: 0 },
      porHora: {},
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
