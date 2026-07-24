/** Cliente retornado por `serverSupabaseServiceRole` do módulo `@nuxtjs/supabase` (service role). */
type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

function parseColunaId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    return n >= 1 ? n : null
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number.parseInt(raw.trim(), 10)
    return Number.isFinite(n) && n >= 1 ? n : null
  }
  return null
}

/**
 * Garante posição inicial no funil para conversas novas no webhook.
 *
 * Grava `coluna_id` e `funil_id` em `public.conversas` (não usa `funil_conversa_status`).
 * Usa `workspace.funil_origem_leads` + `workspace.coluna_origem_leads` como entrada.
 * Não altera conversas já posicionadas (`coluna_id` preenchido).
 */
export async function ensureFunilLeadNoWebhook(
  admin: SupabaseAdmin,
  conversaKey: string,
  workspaceId: number | null,
  updatedAt: string,
): Promise<void> {
  const key = conversaKey?.trim()
  if (!key || workspaceId == null || !Number.isFinite(workspaceId) || workspaceId < 1) {
    return
  }

  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('coluna_id, funil_id')
    .eq('key', key)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) {
    console.warn('[webhook] conversas funil lookup:', convErr.message)
    return
  }

  if (conversa?.coluna_id != null) return

  const { data: ws, error: wsErr } = await admin
    .from('workspace')
    .select('funil_origem_leads, coluna_origem_leads')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (wsErr) {
    console.warn('[webhook] workspace coluna_origem_leads:', wsErr.message)
    return
  }
  if (!ws || typeof ws !== 'object') return

  const colunaId = parseColunaId((ws as { coluna_origem_leads?: unknown }).coluna_origem_leads)
  if (colunaId == null) return

  let funilId = parseColunaId((ws as { funil_origem_leads?: unknown }).funil_origem_leads)

  if (funilId == null) {
    const { data: colunaRow, error: colLookupErr } = await admin
      .from('funil_workspace_colunas')
      .select('funil_id')
      .eq('id', colunaId)
      .is('deleted_at', null)
      .maybeSingle()

    if (colLookupErr) {
      console.warn('[webhook] funil_workspace_colunas lookup:', colLookupErr.message)
      return
    }
    funilId = parseColunaId((colunaRow as { funil_id?: unknown } | null)?.funil_id)
  }

  if (funilId == null) return

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('id', funilId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    console.warn('[webhook] funil_workspace lookup:', funilErr.message)
    return
  }
  if (!funil?.id) return

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id')
    .eq('id', colunaId)
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) {
    console.warn('[webhook] funil_workspace_colunas lookup:', colErr.message)
    return
  }
  if (!coluna) {
    console.warn(
      '[webhook] coluna_origem_leads inválida ou não pertence ao funil do workspace:',
      workspaceId,
      colunaId,
    )
    return
  }

  const { error: upErr } = await admin
    .from('conversas')
    .update({
      coluna_id: colunaId,
      funil_id: funilId,
      updated_at: updatedAt,
    })
    .eq('key', key)
    .is('coluna_id', null)

  if (upErr) {
    console.warn('[webhook] conversas funil update:', upErr.message)
  }
}
