import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

const PRECIOS_PATH = join(process.cwd(), "data", "precios.json")

export type PreciosMap = Record<string, number>

export function loadPrecios(): PreciosMap {
  if (!existsSync(PRECIOS_PATH)) return {}
  try {
    const raw = readFileSync(PRECIOS_PATH, "utf-8")
    return JSON.parse(raw) as PreciosMap
  } catch {
    return {}
  }
}

export function savePrecios(precios: PreciosMap): void {
  writeFileSync(PRECIOS_PATH, JSON.stringify(precios, null, 2), "utf-8")
}

export function getPrecio(precios: PreciosMap, articulo: string): number | null {
  const p = precios[articulo]
  return p != null && p > 0 ? p : null
}
