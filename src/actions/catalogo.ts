"use server"

import { getAllSkus, getSkuIndices, type SkuInfo } from "@/lib/sku"

export interface CatalogoData {
  skus: SkuInfo[]
  indices: ReturnType<typeof getSkuIndices>
  stats: {
    total: number
    mercaderia: number
    envases: number
    marcasUnicas: number
    aboveCore: number
    porDivision: { division: string; count: number }[]
    porUnidadNegocio: { unidadNegocio: string; count: number }[]
    porMarca: { marca: string; count: number }[]
  }
}

export async function getCatalogoData(): Promise<CatalogoData> {
  const skus = getAllSkus()
  const indices = getSkuIndices()

  const divMap = new Map<string, number>()
  const unMap = new Map<string, number>()
  const marcaMap = new Map<string, number>()
  let mercaderia = 0
  let envases = 0
  let aboveCore = 0

  for (const s of skus) {
    if (s.tipoProducto.toUpperCase() === "MERCADERIA") mercaderia++
    if (s.tipoProducto.toUpperCase() === "ENVASE") envases++
    if (s.aboveCore && s.aboveCore.toUpperCase() !== "NO APLICABLE" && s.aboveCore.toUpperCase() !== "") aboveCore++

    if (s.division) divMap.set(s.division, (divMap.get(s.division) || 0) + 1)
    if (s.unidadNegocio) unMap.set(s.unidadNegocio, (unMap.get(s.unidadNegocio) || 0) + 1)
    if (s.marca) marcaMap.set(s.marca, (marcaMap.get(s.marca) || 0) + 1)
  }

  const porDivision = Array.from(divMap.entries())
    .map(([division, count]) => ({ division, count }))
    .sort((a, b) => b.count - a.count)

  const porUnidadNegocio = Array.from(unMap.entries())
    .map(([unidadNegocio, count]) => ({ unidadNegocio, count }))
    .sort((a, b) => b.count - a.count)

  const porMarca = Array.from(marcaMap.entries())
    .map(([marca, count]) => ({ marca, count }))
    .sort((a, b) => b.count - a.count)

  const marcasUnicas = marcaMap.size

  return {
    skus,
    indices,
    stats: {
      total: skus.length,
      mercaderia,
      envases,
      marcasUnicas,
      aboveCore,
      porDivision,
      porUnidadNegocio,
      porMarca,
    },
  }
}
