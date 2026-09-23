import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaEndereco } from '#shared/types/loja'
import { carregarCanalLojaPublica, parseIdPositivo } from './lojaLogin'

type Admin = ReturnType<typeof serverSupabaseServiceRole<any>>

export const ENDERECO_SELECT =
  'id, conversa_key, workspace_id, id_canal, rua, numero, complemento, bairro, cidade, uf, cep, ponto_referencia, apelido, padrao, latitude, longitude'

export type LojaConversaEndereco = {
  key: string
  workspace_id: number
  id_canal: number
}

function asText(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback
  return String(raw).trim()
}

function asTextOrNull(raw: unknown): string | null {
  const t = asText(raw)
  return t || null
}

function asCoord(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

export function parseConversaKey(raw: unknown): string {
  const key = String(raw ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'conversa_key inválida.' })
  }
  return key
}

export function parseEnderecoRow(raw: unknown): LojaEndereco | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const id = parseIdPositivo(rec.id)
  if (id == null) return null
  return {
    id,
    conversa_key: asText(rec.conversa_key) || undefined,
    workspace_id: parseIdPositivo(rec.workspace_id) ?? undefined,
    id_canal: parseIdPositivo(rec.id_canal) ?? undefined,
    rua: asText(rec.rua),
    numero: asText(rec.numero),
    complemento: asTextOrNull(rec.complemento),
    bairro: asText(rec.bairro),
    cidade: asText(rec.cidade),
    uf: asText(rec.uf),
    cep: asText(rec.cep),
    ponto_referencia: asTextOrNull(rec.ponto_referencia),
    apelido: asTextOrNull(rec.apelido),
    padrao: rec.padrao === true,
    lat: asCoord(rec.latitude ?? rec.lat),
    lon: asCoord(rec.longitude ?? rec.lon),
  }
}

export function camposEnderecoDeBody(body: Record<string, unknown>) {
  const rua = asText(body.rua)
  if (!rua) {
    throw createError({ statusCode: 400, statusMessage: 'Informe a rua.' })
  }
  const numero = asText(body.numero)
  if (!numero) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o número.' })
  }
  const bairro = asText(body.bairro)
  if (!bairro) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o bairro.' })
  }
  const cidade = asText(body.cidade)
  if (!cidade) {
    throw createError({ statusCode: 400, statusMessage: 'Informe a cidade.' })
  }
  const uf = asText(body.uf)
  if (!uf) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o estado.' })
  }
  const cep = asText(body.cep)
  if (!cep) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o CEP.' })
  }
  return {
    rua,
    numero,
    complemento: asTextOrNull(body.complemento),
    bairro,
    cidade,
    uf,
    cep,
    ponto_referencia: asTextOrNull(body.ponto_referencia),
    apelido: asTextOrNull(body.apelido),
    padrao: body.padrao === true,
    latitude: asCoord(body.latitude ?? body.lat),
    longitude: asCoord(body.longitude ?? body.lon),
  }
}

export async function carregarConversaLoja(
  admin: Admin,
  conversaKey: string,
  idCanal: number,
): Promise<LojaConversaEndereco> {
  const canal = await carregarCanalLojaPublica(admin, idCanal)
  const { data, error } = await admin
    .from('conversas')
    .select('key, id_canal, workspace_id, deleted_at')
    .eq('key', conversaKey)
    .eq('id_canal', canal.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const key = asText((data as { key?: unknown } | null)?.key)
  if (!key) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado.' })
  }

  return {
    key,
    workspace_id: canal.workspace_id,
    id_canal: canal.id,
  }
}

export async function desmarcarOutrosPadrao(
  admin: Admin,
  conversaKey: string,
  exceptId?: number,
) {
  let q = admin
    .from('enderecos_clientes')
    .update({ padrao: false, updated_at: new Date().toISOString() })
    .eq('conversa_key', conversaKey)
    .eq('padrao', true)
    .is('deleted_at', null)
  if (exceptId != null) q = q.neq('id', exceptId)
  const { error } = await q
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
}
