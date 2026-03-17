"use server"

import { loadPrecios, savePrecios, type PreciosMap } from "@/lib/precios"

export async function getPrecios(): Promise<PreciosMap> {
  return loadPrecios()
}

export async function updatePrecio(articulo: string, precio: number): Promise<PreciosMap> {
  const precios = loadPrecios()
  if (precio > 0) {
    precios[articulo] = precio
  } else {
    delete precios[articulo]
  }
  savePrecios(precios)
  return precios
}

export async function importPreciosFromData(data: Array<{ cod: string; precio: number }>): Promise<{ total: number; actualizados: number }> {
  const precios = loadPrecios()
  let actualizados = 0
  for (const item of data) {
    const cod = item.cod?.trim()
    if (cod && item.precio > 0) {
      precios[cod] = item.precio
      actualizados++
    }
  }
  savePrecios(precios)
  return { total: Object.keys(precios).length, actualizados }
}
