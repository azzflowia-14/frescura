// Feriados nacionales argentinos 2025-2027 (inamovibles + trasladables)
const FERIADOS: string[] = [
  // 2025
  "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02",
  "2025-04-18", "2025-05-01", "2025-05-25", "2025-06-16", "2025-06-20",
  "2025-07-09", "2025-08-17", "2025-10-12", "2025-11-24", "2025-12-08", "2025-12-25",
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02",
  "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20",
  "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-15", "2027-02-16", "2027-03-24", "2027-03-26",
  "2027-04-02", "2027-05-01", "2027-05-25", "2027-06-20", "2027-06-21",
  "2027-07-09", "2027-08-16", "2027-10-11", "2027-11-22", "2027-12-08", "2027-12-25",
]

const feriadoSet = new Set(FERIADOS)

function isFeriado(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10)
  return feriadoSet.has(iso)
}

/**
 * Calcula días hábiles de un mes completo.
 * Lun-Vie = 1, Sáb = 0.5, Dom = 0. Feriados = 0.
 */
export function getDiasHabiles(mes: number, anio: number): number {
  let total = 0
  const daysInMonth = new Date(anio, mes, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(anio, mes - 1, d)
    if (isFeriado(date)) continue
    const dow = date.getDay()
    if (dow === 0) continue // Domingo
    if (dow === 6) total += 0.5 // Sábado
    else total += 1 // Lun-Vie
  }

  return total
}

/**
 * Días hábiles transcurridos hasta hoy (inclusive) en el mes dado.
 */
export function getDiasHabilesHastaHoy(mes: number, anio: number): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let total = 0
  const daysInMonth = new Date(anio, mes, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(anio, mes - 1, d)
    if (date > hoy) break
    if (isFeriado(date)) continue
    const dow = date.getDay()
    if (dow === 0) continue
    if (dow === 6) total += 0.5
    else total += 1
  }

  return total
}

/**
 * Días hábiles restantes en el mes (desde mañana).
 */
export function getDiasHabilesRestantes(mes: number, anio: number): number {
  return getDiasHabiles(mes, anio) - getDiasHabilesHastaHoy(mes, anio)
}
