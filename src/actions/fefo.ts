"use server"

import { query } from "@/lib/db"
import { getSkuInfo } from "@/lib/sku"

export interface FefoViolation {
  tipo: string
  cd: string
  empresa: string
  // Picking (lo que se sacó mal - más nuevo)
  pickingContenedor: string
  pickingArticulo: string
  pickingLote: string
  pickingVencimiento: string
  pickingUbicacion: string
  pickingCantidad: number
  pickingEstado: string
  // Almacén (lo que debería haber salido primero - más viejo)
  almacenContenedor: string
  almacenArticulo: string
  almacenLote: string
  almacenVencimiento: string
  almacenUbicacion: string
  almacenCantidad: number
  almacenEstado: string
  // Calculados
  diasDiferencia: number
  division: string
}

export interface FefoData {
  violations: FefoViolation[]
  totales: {
    total: number
    porEmpresa: Record<string, number>
    porArticulo: Record<string, number>
    porDivision: Record<string, number>
  }
  timestamp: string
  error?: string
}

export async function getFefoData(): Promise<FefoData> {
  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT TOP 500 *
      FROM dbo.REPORTE_STOCK_FEFO_VULNERADO
      ORDER BY 1
    `)

    if (rows.length === 0) {
      return {
        violations: [],
        totales: { total: 0, porEmpresa: {}, porArticulo: {}, porDivision: {} },
        timestamp: new Date().toISOString(),
      }
    }

    // Map columns - view has: Tipo, CD, Empresa, then Picking and Almacen pairs
    const cols = Object.keys(rows[0])

    const violations: FefoViolation[] = rows.map((r) => {
      const pickVenc = parseDate(String(r[cols[7]] || r["Vencimiento"] || ""))
      const almVenc = parseDate(String(r[cols[13]] || ""))
      const diasDif =
        pickVenc && almVenc
          ? Math.round((pickVenc.getTime() - almVenc.getTime()) / (1000 * 60 * 60 * 24))
          : 0

      return {
        tipo: String(r[cols[0]] || r["Tipo"] || ""),
        cd: String(r[cols[1]] || r["CD"] || ""),
        empresa: String(r[cols[2]] || r["Empresa"] || ""),
        pickingContenedor: String(r[cols[3]] || ""),
        pickingArticulo: String(r[cols[4]] || ""),
        pickingLote: String(r[cols[5]] || ""),
        pickingVencimiento: formatDate(pickVenc),
        pickingUbicacion: String(r[cols[8]] || ""),
        pickingCantidad: Number(r[cols[9]] || 0),
        pickingEstado: String(r[cols[10]] || ""),
        almacenContenedor: String(r[cols[11]] || ""),
        almacenArticulo: String(r[cols[12]] || ""),
        almacenLote: String(r[cols[13]] || ""),
        almacenVencimiento: formatDate(almVenc),
        almacenUbicacion: String(r[cols[14]] || ""),
        almacenCantidad: Number(r[cols[15]] || 0),
        almacenEstado: String(r[cols[16]] || ""),
        diasDiferencia: diasDif,
        division: getSkuInfo(String(r[cols[4]] || "").trim())?.division ?? "",
      }
    })

    const porEmpresa: Record<string, number> = {}
    const porArticulo: Record<string, number> = {}
    const porDivision: Record<string, number> = {}
    for (const v of violations) {
      porEmpresa[v.empresa] = (porEmpresa[v.empresa] || 0) + 1
      const art = v.pickingArticulo || v.almacenArticulo
      if (art) porArticulo[art] = (porArticulo[art] || 0) + 1
      if (v.division) porDivision[v.division] = (porDivision[v.division] || 0) + 1
    }

    return {
      violations,
      totales: { total: violations.length, porEmpresa, porArticulo, porDivision },
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return {
      violations: [],
      totales: { total: 0, porEmpresa: {}, porArticulo: {}, porDivision: {} },
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function parseDate(str: string): Date | null {
  if (!str) return null
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date | null): string {
  if (!d) return "-"
  return d.toLocaleDateString("es-AR")
}
