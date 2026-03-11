"use server"

import { query } from "@/lib/db"

export interface OperarioProductividad {
  usuario: string
  tarea: string
  empresa: string
  tiempoMinutos: number
  unidades: number
  bultos: number
  pallets: number
  prodUnidades: number
  prodBultos: number
  prodPallets: number
}

export interface ResumenOperario {
  usuario: string
  tiempoTotalMin: number
  unidadesTotal: number
  bultosTotal: number
  palletsTotal: number
  tareas: number
  eficiencia: number // unidades por minuto
}

export interface ProductividadData {
  fecha: string
  operarios: ResumenOperario[]
  porTarea: Record<string, { usuarios: number; unidades: number; bultos: number; tiempo: number }>
  totales: {
    operarios: number
    tiempoTotalMin: number
    unidadesTotal: number
    bultosTotal: number
    palletsTotal: number
  }
  detalle: OperarioProductividad[]
  timestamp: string
  error?: string
}

export async function getProductividadData(fecha?: string): Promise<ProductividadData> {
  const fechaQuery = fecha || new Date().toISOString().split("T")[0]

  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT *
      FROM dbo.Vista_Productividad_Diaria
      WHERE CONVERT(date, Fecha) = @fecha
      ORDER BY Usuario
    `, { fecha: fechaQuery })

    const detalle: OperarioProductividad[] = rows.map((r) => ({
      usuario: String(r["Usuario"] || ""),
      tarea: String(r["Tarea"] || ""),
      empresa: String(r["Empresa"] || ""),
      tiempoMinutos: Number(r["TiempoUtilizadoMinutos"] || 0),
      unidades: Number(r["ProductividadUnidades"] || 0),
      bultos: Number(r["ProductividadBultos"] || 0),
      pallets: Number(r["ProductividadPallets"] || 0),
      prodUnidades: Number(r["ProducciónUnidades"] || r["ProduccionUnidades"] || 0),
      prodBultos: Number(r["ProducciónBultos"] || r["ProduccionBultos"] || 0),
      prodPallets: Number(r["ProducciónPallets"] || r["ProduccionPallets"] || 0),
    }))

    // Agrupar por operario
    const byOperario = new Map<string, ResumenOperario>()
    const porTarea: Record<string, { usuarios: Set<string>; unidades: number; bultos: number; tiempo: number }> = {}

    for (const d of detalle) {
      // Por operario
      const existing = byOperario.get(d.usuario)
      if (existing) {
        existing.tiempoTotalMin += d.tiempoMinutos
        existing.unidadesTotal += d.prodUnidades
        existing.bultosTotal += d.prodBultos
        existing.palletsTotal += d.prodPallets
        existing.tareas++
      } else {
        byOperario.set(d.usuario, {
          usuario: d.usuario,
          tiempoTotalMin: d.tiempoMinutos,
          unidadesTotal: d.prodUnidades,
          bultosTotal: d.prodBultos,
          palletsTotal: d.prodPallets,
          tareas: 1,
          eficiencia: 0,
        })
      }

      // Por tarea
      if (!porTarea[d.tarea]) porTarea[d.tarea] = { usuarios: new Set(), unidades: 0, bultos: 0, tiempo: 0 }
      porTarea[d.tarea].usuarios.add(d.usuario)
      porTarea[d.tarea].unidades += d.prodUnidades
      porTarea[d.tarea].bultos += d.prodBultos
      porTarea[d.tarea].tiempo += d.tiempoMinutos
    }

    // Calcular eficiencia
    const operarios = Array.from(byOperario.values()).map((o) => ({
      ...o,
      eficiencia: o.tiempoTotalMin > 0 ? Math.round((o.unidadesTotal / o.tiempoTotalMin) * 100) / 100 : 0,
    }))
    operarios.sort((a, b) => b.unidadesTotal - a.unidadesTotal)

    const porTareaSerialized: Record<string, { usuarios: number; unidades: number; bultos: number; tiempo: number }> = {}
    for (const [k, v] of Object.entries(porTarea)) {
      porTareaSerialized[k] = { usuarios: v.usuarios.size, unidades: v.unidades, bultos: v.bultos, tiempo: v.tiempo }
    }

    return {
      fecha: fechaQuery,
      operarios,
      porTarea: porTareaSerialized,
      totales: {
        operarios: operarios.length,
        tiempoTotalMin: operarios.reduce((s, o) => s + o.tiempoTotalMin, 0),
        unidadesTotal: operarios.reduce((s, o) => s + o.unidadesTotal, 0),
        bultosTotal: operarios.reduce((s, o) => s + o.bultosTotal, 0),
        palletsTotal: operarios.reduce((s, o) => s + o.palletsTotal, 0),
      },
      detalle,
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return {
      fecha: fechaQuery,
      operarios: [],
      porTarea: {},
      totales: { operarios: 0, tiempoTotalMin: 0, unidadesTotal: 0, bultosTotal: 0, palletsTotal: 0 },
      detalle: [],
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
