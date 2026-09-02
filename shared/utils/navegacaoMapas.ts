export type CoordenadasValidas = { lat: number; lng: number }

/** Valida par latitude/longitude de `notificacoes_ia`. */
export function parseCoordenadasValidas(
  lat: unknown,
  lng: unknown,
): CoordenadasValidas | null {
  if (lat == null || lng == null) return null
  const latN = typeof lat === 'number' ? lat : Number(lat)
  const lngN = typeof lng === 'number' ? lng : Number(lng)
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null
  if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return null
  return { lat: latN, lng: lngN }
}

export function urlGoogleMaps(c: CoordenadasValidas): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`
}

export function urlWaze(c: CoordenadasValidas): string {
  return `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`
}
