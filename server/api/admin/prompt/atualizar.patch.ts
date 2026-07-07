import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminPromptAtualizarBody, PromptWorkspaceComPrincipal } from '#shared/types/adminPrompt'
import { PROMPT_WORKSPACE_TIPO_DEFAULT } from '#shared/types/adminPrompt'
import {
  assertAdminWorkspaceAtivo,
  assertPromptDoWorkspace,
  getPromptPrincipalId,
  parsePromptId,
  parseTextoObrigatorio,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function mapPromptRow(r: Record<string, unknown>, principalId: number | null): PromptWorkspaceComPrincipal {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspaceId = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)

  const mapped: PromptWorkspaceComPrincipal = {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspaceId) ? workspaceId : 0,
    nome: String(r.nome ?? '').trim(),
    tipo: String(r.tipo ?? PROMPT_WORKSPACE_TIPO_DEFAULT).trim(),
    prompt: String(r.prompt ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    principal: false,
  }

  mapped.principal = principalId != null && mapped.id === principalId
  return mapped
}

/**
 * PATCH /api/admin/prompt/atualizar
 * Body: `{ workspace_id, id, nome, prompt, tipo?, definir_principal? }`
 */
export default defineEventHandler(async (event): Promise<PromptWorkspaceComPrincipal> => {
  assertMethod(event, 'PATCH')

  await requireAdminUser(event)

  const body = await readBody<AdminPromptAtualizarBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const promptId = parsePromptId(body?.id)

  await assertAdminWorkspaceAtivo(event, workspaceId)
  await assertPromptDoWorkspace(event, promptId, workspaceId)

  const nome = parseTextoObrigatorio(body?.nome, 'nome', 200)
  const prompt = parseTextoObrigatorio(body?.prompt, 'prompt')
  const tipoRaw = body?.tipo != null ? String(body.tipo).trim() : null

  const updatePayload: Record<string, unknown> = {
    nome,
    prompt,
    updated_at: new Date().toISOString(),
  }

  if (tipoRaw) updatePayload.tipo = tipoRaw

  const admin = serverSupabaseServiceRole<any>(event)

  const principalIdAntes = await getPromptPrincipalId(event, workspaceId)
  const eraPrincipal = principalIdAntes === promptId

  const { data, error } = await admin
    .from('prompt_workspace')
    .update(updatePayload)
    .eq('id', promptId)
    .eq('workspace_id', workspaceId)
    .select('id, workspace_id, nome, tipo, prompt, created_at, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const definirPrincipal = body?.definir_principal
  if (definirPrincipal === true) {
    const { error: wsErr } = await admin
      .from('workspace')
      .update({ prompt_principal: promptId })
      .eq('id', workspaceId)

    if (wsErr) {
      throw createError({ statusCode: 500, statusMessage: wsErr.message })
    }

    await admin
      .from('prompt_workspace')
      .update({ tipo: 'principal', updated_at: new Date().toISOString() })
      .eq('id', promptId)
      .eq('workspace_id', workspaceId)
  } else if (definirPrincipal === false && eraPrincipal) {
    const { error: wsErr } = await admin
      .from('workspace')
      .update({ prompt_principal: null })
      .eq('id', workspaceId)

    if (wsErr) {
      throw createError({ statusCode: 500, statusMessage: wsErr.message })
    }
  }

  const principalId = await getPromptPrincipalId(event, workspaceId)
  return mapPromptRow(data as Record<string, unknown>, principalId)
})
