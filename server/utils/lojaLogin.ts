import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaLogin } from '#shared/types/loja'
import { celularParaGravar, variantesCelularBusca } from '#shared/utils/lojaCelular'

type Admin = ReturnType<typeof serverSupabaseServiceRole<any>>

export type LojaCanalLogin = {
  id: number
  workspace_id: number
}

type ConversaLoginRow = {
  key: string
  name: string | null
  phone: string | null
  documento: string | null
}

export function parseIdPositivo(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.trunc(n)
}

export async function carregarCanalLojaPublica(
  admin: Admin,
  idCanal: number,
): Promise<LojaCanalLogin> {
  const { data, error } = await admin
    .from('canais')
    .select('id, workspace_id, loja_slug, deleted_at')
    .eq('id', idCanal)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const row = data as { id?: unknown; workspace_id?: unknown; loja_slug?: unknown } | null
  const id = parseIdPositivo(row?.id)
  const workspaceId = parseIdPositivo(row?.workspace_id)
  const slug = String(row?.loja_slug ?? '').trim()
  if (id == null || workspaceId == null || !slug) {
    throw createError({ statusCode: 404, statusMessage: 'Loja não encontrada.' })
  }

  return { id, workspace_id: workspaceId }
}

function mapearLogin(row: ConversaLoginRow): LojaLogin | null {
  const key = String(row.key ?? '').trim()
  if (!key) return null
  return {
    key,
    nome: String(row.name ?? '').trim(),
    celular: String(row.phone ?? '').trim(),
    cpf: String(row.documento ?? '').trim(),
  }
}

async function buscarPorPhones(
  admin: Admin,
  idCanal: number,
  phones: string[],
): Promise<LojaLogin | null> {
  if (!phones.length) return null

  const { data, error } = await admin
    .from('conversas')
    .select('key, name, phone, documento')
    .eq('id_canal', idCanal)
    .in('phone', phones)
    .is('deleted_at', null)
    .or('is_group.is.null,is_group.eq.false')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const row = Array.isArray(data) ? (data[0] as ConversaLoginRow | undefined) : null
  return row ? mapearLogin(row) : null
}

/** Primeiro com o 9 extra; se não achar, sem o 9. */
export async function buscarConversaPorCelular(
  admin: Admin,
  idCanal: number,
  celular: unknown,
): Promise<LojaLogin | null> {
  const { comNove, semNove } = variantesCelularBusca(celular)
  const com = await buscarPorPhones(admin, idCanal, comNove)
  if (com) return com
  if (semNove.every((p) => comNove.includes(p))) return null
  return buscarPorPhones(admin, idCanal, semNove)
}

async function colunaOrigemOpcional(
  admin: Admin,
  workspaceId: number,
): Promise<{ coluna_id: number; funil_id: number } | null> {
  const { data: ws } = await admin
    .from('workspace')
    .select('coluna_origem_leads')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  const colunaId = parseIdPositivo((ws as { coluna_origem_leads?: unknown } | null)?.coluna_origem_leads)
  if (colunaId == null) return null

  const { data: coluna } = await admin
    .from('funil_workspace_colunas')
    .select('id, funil_id')
    .eq('id', colunaId)
    .is('deleted_at', null)
    .maybeSingle()

  const funilId = parseIdPositivo((coluna as { funil_id?: unknown } | null)?.funil_id)
  if (funilId == null) return null
  return { coluna_id: colunaId, funil_id: funilId }
}

export function documentoCpf(raw: unknown): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  return d.length === 11 ? d : ''
}

/** Completa nome e/ou CPF da conversa com o que o cliente preencheu. */
export async function completarDocumentoLogin(
  admin: Admin,
  params: { conversaKey: string; idCanal: number; cpf?: unknown; nome?: unknown },
): Promise<LojaLogin> {
  const documento = params.cpf === undefined ? '' : documentoCpf(params.cpf)
  if (params.cpf !== undefined && !documento) {
    throw createError({ statusCode: 400, statusMessage: 'CPF inválido.' })
  }
  const nome = String(params.nome ?? '').trim()
  if (params.nome !== undefined && !nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
  }
  if (!documento && !nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe nome ou CPF.' })
  }

  const { data, error } = await admin
    .from('conversas')
    .select('key, name, phone, documento')
    .eq('key', params.conversaKey)
    .eq('id_canal', params.idCanal)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const atual = data ? mapearLogin(data as ConversaLoginRow) : null
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado.' })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (documento) patch.documento = documento
  if (nome) patch.name = nome

  const { error: updErr } = await admin
    .from('conversas')
    .update(patch)
    .eq('key', atual.key)
    .eq('id_canal', params.idCanal)

  if (updErr) throw createError({ statusCode: 500, statusMessage: updErr.message })
  return {
    ...atual,
    cpf: documento || atual.cpf,
    nome: nome || atual.nome,
  }
}

export async function criarConversaLoja(
  admin: Admin,
  canal: LojaCanalLogin,
  nome: string,
  celular: unknown,
  cpf: unknown,
): Promise<LojaLogin> {
  const phone = celularParaGravar(celular)
  if (!phone) {
    throw createError({ statusCode: 400, statusMessage: 'Celular inválido.' })
  }
  const documento = documentoCpf(cpf)
  if (!documento) {
    throw createError({ statusCode: 400, statusMessage: 'CPF inválido.' })
  }

  const existente = await buscarConversaPorCelular(admin, canal.id, phone)
  if (existente) {
    return completarDocumentoLogin(admin, {
      conversaKey: existente.key,
      idCanal: canal.id,
      cpf: documento,
    })
  }

  const origem = await colunaOrigemOpcional(admin, canal.workspace_id)
  const key = globalThis.crypto.randomUUID()
  const nowIso = new Date().toISOString()

  const { data, error } = await admin
    .from('conversas')
    .insert({
      key,
      id_canal: canal.id,
      workspace_id: canal.workspace_id,
      phone,
      name: nome.trim(),
      documento,
      lid: null,
      photo: null,
      message: null,
      messatype: null,
      connect_phone: null,
      from_me: null,
      media_url: null,
      conversa_aberta: true,
      is_group: false,
      nao_lidas: 0,
      ia_ligada: true,
      coluna_id: origem?.coluna_id ?? null,
      funil_id: origem?.funil_id ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('key, name, phone, documento')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const login = mapearLogin(data as ConversaLoginRow)
  if (!login) throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o cadastro.' })
  return login
}
