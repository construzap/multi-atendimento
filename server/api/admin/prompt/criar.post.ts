import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminPromptCriarBody, PromptWorkspaceComPrincipal } from '#shared/types/adminPrompt'
import { PROMPT_WORKSPACE_TIPO_DEFAULT } from '#shared/types/adminPrompt'
import {
  assertAdminWorkspaceAtivo,
  getPromptPrincipalId,
  parseTextoObrigatorio,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function mapPromptRow(r: Record<string, unknown>): PromptWorkspaceComPrincipal {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspaceId = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)

  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspaceId) ? workspaceId : 0,
    nome: String(r.nome ?? '').trim(),
    tipo: String(r.tipo ?? PROMPT_WORKSPACE_TIPO_DEFAULT).trim(),
    prompt: String(r.prompt ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    principal: false,
  }
}

/**
 * POST /api/admin/prompt/criar
 * Body: `{ workspace_id, nome, prompt, tipo? }`
 */
export default defineEventHandler(async (event): Promise<PromptWorkspaceComPrincipal> => {
  assertMethod(event, 'POST')

  await requireAdminUser(event)

  const body = await readBody<AdminPromptCriarBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const nome = parseTextoObrigatorio(body?.nome, 'nome', 200)
  const prompt = parseTextoObrigatorio(body?.prompt, 'prompt')
  const tipoRaw = String(body?.tipo ?? PROMPT_WORKSPACE_TIPO_DEFAULT).trim()
  const tipo = tipoRaw || PROMPT_WORKSPACE_TIPO_DEFAULT

  const admin = serverSupabaseServiceRole<any>(event)
  const agora = new Date().toISOString()

  const { data, error } = await admin
    .from('prompt_workspace')
    .insert({
      workspace_id: workspaceId,
      nome,
      prompt,
      tipo,
      updated_at: agora,
    })
    .select('id, workspace_id, nome, tipo, prompt, created_at, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const criado = mapPromptRow(data as Record<string, unknown>)
  const principalId = await getPromptPrincipalId(event, workspaceId)
  criado.principal = principalId != null && criado.id === principalId

  return criado
})
