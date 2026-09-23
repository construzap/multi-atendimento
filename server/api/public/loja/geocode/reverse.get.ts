import { assertMethod, createError, getQuery } from 'h3'
import type { LojaGeocodeReverso } from '#shared/types/loja'

type NominatimAddress = {
  road?: string
  street?: string
  pedestrian?: string
  footway?: string
  path?: string
  residential?: string
  cycleway?: string
  living_street?: string
  house_number?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  city_district?: string
  city_block?: string
  hamlet?: string
  isolated_dwelling?: string
  city?: string
  town?: string
  municipality?: string
  village?: string
  county?: string
  state?: string
  state_district?: string
  postcode?: string
  country?: string
  country_code?: string
  'ISO3166-2-lvl4'?: string
}

function primeiro(...vals: Array<string | undefined>): string {
  for (const v of vals) {
    const t = String(v ?? '').trim()
    if (t) return t
  }
  return ''
}

function estadoDe(addr: NominatimAddress): string {
  const state = primeiro(addr.state)
  if (state) return state
  const iso = primeiro(addr['ISO3166-2-lvl4'])
  const m = iso.match(/^[A-Za-z]{2}-([A-Za-z]{2})$/)
  return m ? m[1].toUpperCase() : ''
}

type NominatimReverse = {
  display_name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
}

let ultimaChamada = 0

/**
 * GET /api/public/loja/geocode/reverse?lat=&lon=
 * Reverse geocode via Nominatim (servidor, com User-Agent).
 */
export default defineEventHandler(async (event): Promise<{ ok: true; data: LojaGeocodeReverso }> => {
  assertMethod(event, 'GET')

  const q = getQuery(event)
  const lat = Number(q.lat)
  const lon = Number(q.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw createError({ statusCode: 400, statusMessage: 'Coordenadas inválidas.' })
  }

  const agora = Date.now()
  const espera = 1100 - (agora - ultimaChamada)
  if (espera > 0) {
    await new Promise((r) => setTimeout(r, espera))
  }
  ultimaChamada = Date.now()

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json&addressdetails=1&zoom=18&accept-language=pt-BR`

  let data: NominatimReverse
  try {
    data = await $fetch<NominatimReverse>(url, {
      headers: {
        'User-Agent': 'construzap-loja/1.0 (loja@construzap.com)',
        Accept: 'application/json',
      },
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Não foi possível obter o endereço desta localização.',
    })
  }

  const addr = data.address ?? {}
  return {
    ok: true,
    data: {
      enderecoCompleto: primeiro(data.display_name),
      rua: primeiro(
        addr.road,
        addr.street,
        addr.pedestrian,
        addr.residential,
        addr.living_street,
        addr.footway,
        addr.path,
        addr.cycleway,
      ),
      numero: primeiro(addr.house_number),
      bairro: primeiro(
        addr.suburb,
        addr.neighbourhood,
        addr.quarter,
        addr.city_district,
        addr.city_block,
        addr.hamlet,
        addr.isolated_dwelling,
      ),
      cidade: primeiro(addr.city, addr.town, addr.municipality, addr.village, addr.county),
      estado: estadoDe(addr),
      cep: primeiro(addr.postcode),
      pais: primeiro(addr.country, addr.country_code?.toUpperCase()),
      lat,
      lon,
    },
  }
})
