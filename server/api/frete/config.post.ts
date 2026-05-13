import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { FreteConfigWorkspace } from '#shared/types/frete'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  capacidade_caminhao_kg?: unknown
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

/**
 * Interpreta valor em kg no formato pt-BR (ex.: `1.000`, `1.234,56`).
 */
function parseCapacidadeKg(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Capacidade não pode ser negativa.' })
    }
    return raw
  }
  let s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/kg/gi, '')
  if (!s.length) {
    throw createError({ statusCode: 400, statusMessage: 'Informe a capacidade em kg.' })
  }

  let n: number
  if (s.includes(',')) {
    const parts = s.split(',')
    const intPart = parts[0] ?? ''
    const frac = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2)
    const intNorm = intPart.replace(/\./g, '')
    n = Number.parseFloat(`${intNorm}.${frac.length ? frac : '0'}`)
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    n = Number.parseFloat(s.replace(/\./g, ''))
  } else {
    n = Number.parseFloat(s.replace(',', '.'))
  }

  if (!Number.isFinite(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Capacidade inválida.' })
  }
  if (n > 99_999_999.99) {
    throw createError({ statusCode: 400, statusMessage: 'Capacidade acima do limite permitido.' })
  }
  return Math.round(n * 100) / 100
}

function mapRow(r: Record<string, unknown>): FreteConfigWorkspace {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspace_id = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const capacidade_caminhao_kg =
    typeof r.capacidade_caminhao_kg === 'number'
      ? r.capacidade_caminhao_kg
      : Number.parseFloat(String(r.capacidade_caminhao_kg ?? ''))
  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspace_id) ? workspace_id : 0,
    capacidade_caminhao_kg: Number.isFinite(capacidade_caminhao_kg) ? capacidade_caminhao_kg : 0,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

/**
 * POST /api/frete/config
 *
 * Body: `{ workspace_id, capacidade_caminhao_kg }` — upsert em `frete_config_workspace` pela `workspace_id` única.
 */
export default defineEventHandler(async (event): Promise<FreteConfigWorkspace> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const kg = parseCapacidadeKg(body.capacidade_caminhao_kg)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('frete_config_workspace')
    .upsert(
      {
        workspace_id: workspaceId,
        capacidade_caminhao_kg: kg,
        updated_at: now,
      },
      { onConflict: 'workspace_id' },
    )
    .select('id, workspace_id, capacidade_caminhao_kg, created_at, updated_at')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível gravar a configuração de frete.' })
  }

  return mapRow(data as Record<string, unknown>)
})
