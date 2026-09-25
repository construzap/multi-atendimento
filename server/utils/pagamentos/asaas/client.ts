import { createError } from 'h3'

type AsaasErroBody = {
  errors?: Array<{ description?: string; code?: string }>
}

export function asaasBaseUrl(apiKey: string): string {
  const k = apiKey.toLowerCase()
  if (k.includes('hmlg') || k.includes('sandbox')) {
    return 'https://api-sandbox.asaas.com/v3'
  }
  return 'https://api.asaas.com/v3'
}

export function mensagemErroAsaas(err: unknown, fallback: string): string {
  const data = (err as { data?: AsaasErroBody })?.data
  const desc = data?.errors?.[0]?.description?.trim()
  return desc || fallback
}

export async function asaasFetch<T>(
  apiKey: string,
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const method = opts.method ?? 'GET'
  try {
    return await $fetch<T>(`${asaasBaseUrl(apiKey)}${path}`, {
      method,
      body: opts.body,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    throw createError({
      statusCode: 502,
      statusMessage: mensagemErroAsaas(err, 'Falha ao comunicar com o Asaas.'),
    })
  }
}

export function soDigitos(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '')
}

export function arredondarDinheiro(n: number): number {
  return Math.round(n * 100) / 100
}

export function aplicarTaxaCartao(
  valor: number,
  parcelas: number,
  taxas?: Record<string, number>,
): number {
  if (parcelas < 2 || !taxas) return arredondarDinheiro(valor)
  const taxa = taxas[`${parcelas}x`]
  if (taxa == null || !Number.isFinite(taxa) || taxa <= 0) return arredondarDinheiro(valor)
  return arredondarDinheiro(valor * (1 + taxa / 100))
}

export function dataVencimentoIso(dias = 1): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
