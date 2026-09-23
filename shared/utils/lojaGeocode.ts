import type { LojaGeocodeReverso } from '#shared/types/loja'

const CAMPOS: { key: keyof LojaGeocodeReverso; label: string }[] = [
  { key: 'rua', label: 'rua' },
  { key: 'bairro', label: 'bairro' },
  { key: 'cidade', label: 'cidade' },
  { key: 'estado', label: 'estado' },
  { key: 'cep', label: 'CEP' },
  { key: 'pais', label: 'país' },
  { key: 'enderecoCompleto', label: 'endereço completo' },
]

export function camposGeocodeFaltando(geo: LojaGeocodeReverso | null): string[] {
  if (!geo) return CAMPOS.map((c) => c.label).concat('latitude', 'longitude')
  const faltando: string[] = []
  for (const campo of CAMPOS) {
    if (!String(geo[campo.key] ?? '').trim()) faltando.push(campo.label)
  }
  if (!Number.isFinite(geo.lat)) faltando.push('latitude')
  if (!Number.isFinite(geo.lon)) faltando.push('longitude')
  return faltando
}

export function geocodeCompleto(geo: LojaGeocodeReverso | null): boolean {
  return camposGeocodeFaltando(geo).length === 0
}

export function mensagemGeocodeIncompleto(faltando: string[]): string {
  if (!faltando.length) return ''
  return `Ajuste o ponto no mapa. Não encontramos: ${faltando.join(', ')}.`
}
