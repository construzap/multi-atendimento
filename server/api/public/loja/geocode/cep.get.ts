import { assertMethod, createError, getQuery } from 'h3'
import type { LojaCepLookup } from '#shared/types/loja'
import { cepCompleto, formatarCep, normalizarCep } from '#shared/utils/lojaCep'

type ViaCep = {
  erro?: boolean | string
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type BrasilApiCep = {
  cep?: string
  state?: string
  city?: string
  neighborhood?: string
  street?: string
  location?: {
    coordinates?: {
      latitude?: string | number
      longitude?: string | number
    }
  }
}

let ultimaChamada = 0

function texto(raw: unknown): string {
  return String(raw ?? '').trim()
}

function coord(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function temEndereco(d: LojaCepLookup | null): d is LojaCepLookup {
  return Boolean(d && (d.cidade || d.rua || d.bairro))
}

/**
 * GET /api/public/loja/geocode/cep?cep=
 * Busca endereço pelo CEP (BrasilAPI, fallback ViaCEP).
 */
export default defineEventHandler(async (event): Promise<{ ok: true; data: LojaCepLookup }> => {
  assertMethod(event, 'GET')

  const cep = normalizarCep(String(getQuery(event).cep ?? ''))
  if (!cepCompleto(cep)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um CEP com 8 dígitos.' })
  }

  const agora = Date.now()
  const espera = 400 - (agora - ultimaChamada)
  if (espera > 0) {
    await new Promise((r) => setTimeout(r, espera))
  }
  ultimaChamada = Date.now()

  const headers = {
    'User-Agent': 'construzap-loja/1.0 (loja@construzap.com)',
    Accept: 'application/json',
  }

  let data: LojaCepLookup | null = null

  try {
    const br = await $fetch<BrasilApiCep>(`https://brasilapi.com.br/api/cep/v2/${cep}`, { headers })
    data = {
      cep: formatarCep(texto(br.cep) || cep),
      rua: texto(br.street),
      bairro: texto(br.neighborhood),
      cidade: texto(br.city),
      estado: texto(br.state).toUpperCase(),
      complemento: '',
      lat: coord(br.location?.coordinates?.latitude),
      lon: coord(br.location?.coordinates?.longitude),
    }
  } catch {
    data = null
  }

  if (!temEndereco(data)) {
    try {
      const via = await $fetch<ViaCep>(`https://viacep.com.br/ws/${cep}/json/`, { headers })
      if (via.erro === true || via.erro === 'true') {
        throw createError({ statusCode: 404, statusMessage: 'CEP não encontrado.' })
      }
      data = {
        cep: formatarCep(texto(via.cep) || cep),
        rua: texto(via.logradouro),
        bairro: texto(via.bairro),
        cidade: texto(via.localidade),
        estado: texto(via.uf).toUpperCase(),
        complemento: texto(via.complemento),
        lat: data?.lat ?? null,
        lon: data?.lon ?? null,
      }
    } catch (err) {
      if (!temEndereco(data)) {
        const status = (err as { statusCode?: number })?.statusCode
        throw createError({
          statusCode: status === 404 ? 404 : 502,
          statusMessage: status === 404 ? 'CEP não encontrado.' : 'Não foi possível consultar este CEP.',
        })
      }
    }
  }

  if (!temEndereco(data)) {
    throw createError({ statusCode: 404, statusMessage: 'CEP não encontrado.' })
  }

  return { ok: true, data }
})
