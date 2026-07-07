import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  AdminPromptListResponse,
  PromptWorkspace,
  PromptWorkspaceComPrincipal,
} from '#shared/types/adminPrompt'
import { PROMPT_WORKSPACE_TIPO_DEFAULT } from '#shared/types/adminPrompt'
import {
  assertAdminWorkspaceAtivo,
  getPromptPrincipalId,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function mapPromptRow(r: Record<string, unknown>): PromptWorkspace {
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
  }
}

/**
 * GET /api/admin/prompt?workspace_id=
 * Lista prompts do workspace e informa qual é o principal (`workspace.prompt_principal`).
 */
export default defineEventHandler(async (event): Promise<AdminPromptListResponse> => {
  assertMethod(event, 'GET')

  await requireAdminUser(event)

  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const admin = serverSupabaseServiceRole<any>(event)

  const [promptPrincipalId, promptsResult] = await Promise.all([
    getPromptPrincipalId(event, workspaceId),
    admin
      .from('prompt_workspace')
      .select('id, workspace_id, nome, tipo, prompt, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false }),
  ])

  if (promptsResult.error) {
    throw createError({ statusCode: 500, statusMessage: promptsResult.error.message })
  }

  const items: PromptWorkspaceComPrincipal[] = (promptsResult.data ?? []).map((row) => {
    const mapped = mapPromptRow(row as Record<string, unknown>)
    return {
      ...mapped,
      principal: promptPrincipalId != null && mapped.id === promptPrincipalId,
    }
  })

  return {
    items,
    prompt_principal_id: promptPrincipalId,
  }
})
