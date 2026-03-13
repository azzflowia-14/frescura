import skuData from "@/data/sku-master.json"

export interface SkuEspecial {
  michelob: boolean
  h2o: boolean
  redBull: boolean
  laton: boolean
  sinAlcohol: boolean
}

export interface SkuInfo {
  articulo: string
  descripcion: string
  bultosPorPallet: number
  unidadesPorBulto: number
  hlPorUnidad: number
  division: string
  marca: string
  familia: string
  calibre: string
  sabor: string
  segmentoMarca: string
  unidadNegocio: string
  tipoProducto: string
  aboveCore: string
  esCerveza: boolean
  esNabs: boolean
  esEspecial: SkuEspecial
}

type SkuArticles = Record<string, SkuInfo>

const articles = skuData.articles as SkuArticles
const indices = skuData.indices as {
  divisiones: string[]
  marcas: string[]
  familias: string[]
  calibres: string[]
  sabores: string[]
  unidadesNegocio: string[]
  segmentosMarca: string[]
  tiposProducto: string[]
}

export function getSkuInfo(articulo: string | number): SkuInfo | null {
  return articles[String(articulo)] ?? null
}

export function esMercaderia(articulo: string | number): boolean {
  const info = articles[String(articulo)]
  return info?.tipoProducto === "MERCADERIA"
}

export function getUnidadesPorBulto(articulo: string | number): number {
  return articles[String(articulo)]?.unidadesPorBulto ?? 1
}

export function getHlPorUnidad(articulo: string | number): number {
  return articles[String(articulo)]?.hlPorUnidad ?? 0
}

/** Convert bultos to hectoliters for a given article */
export function bultosToHl(articulo: string | number, bultos: number): number {
  const info = articles[String(articulo)]
  if (!info || info.hlPorUnidad <= 0) return 0
  return Math.round(bultos * info.unidadesPorBulto * info.hlPorUnidad * 1000) / 1000
}

/** Convert units to hectoliters for a given article */
export function unidadesToHl(articulo: string | number, unidades: number): number {
  const info = articles[String(articulo)]
  if (!info || info.hlPorUnidad <= 0) return 0
  return Math.round(unidades * info.hlPorUnidad * 1000) / 1000
}

export function getSkuIndices() {
  return indices
}

export function getAllSkus(): SkuInfo[] {
  return Object.values(articles)
}

export type Clasificacion = "cervezas" | "nabs" | "otro"

export function clasificacion(articulo: string | number): Clasificacion {
  const info = articles[String(articulo)]
  if (!info) return "otro"
  if (info.esCerveza) return "cervezas"
  if (info.esNabs) return "nabs"
  return "otro"
}

export type CategoriaEspecial = "michelob" | "h2o" | "redBull" | "laton" | "sinAlcohol"

const CATEGORIAS_ESPECIALES: CategoriaEspecial[] = ["michelob", "h2o", "redBull", "laton", "sinAlcohol"]

export const ESPECIAL_LABELS: Record<CategoriaEspecial, string> = {
  michelob: "Michelob",
  h2o: "H2O",
  redBull: "Red Bull",
  laton: "Latón 473cc",
  sinAlcohol: "0.0% Sin Alcohol",
}

export function getEspeciales(): Record<CategoriaEspecial, SkuInfo[]> {
  const result = {} as Record<CategoriaEspecial, SkuInfo[]>
  for (const cat of CATEGORIAS_ESPECIALES) {
    result[cat] = Object.values(articles).filter((a) => a.esEspecial[cat])
  }
  return result
}
