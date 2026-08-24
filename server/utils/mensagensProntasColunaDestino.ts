import { createError } from 'h3'
import { parsePositiveInt } from './parsePositiveInt'

/** `null` / vazio = não mover contato após a sequência. */
export function parseOptionalColunaDestinoId(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  return parsePositiveInt(raw, 'coluna_destino_id')
}

export function mapColunaDestinoId(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/** Default `true` (coluna DB `ia_ligada boolean not null default true`). */
export function mapIaLigada(raw: unknown): boolean {
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  return true
}

/** Body: se omitido, default `true`. */
export function parseIaLigadaBody(raw: unknown): boolean {
  if (raw === undefined || raw === null || String(raw).trim() === '') return true
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  throw createError({ statusCode: 400, statusMessage: 'ia_ligada inválido (true ou false).' })
}

/** Default `false` (coluna DB `fechar_pedido_em_aberto boolean not null default false`). */
export function mapFecharPedidoEmAberto(raw: unknown): boolean {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return false
}

/** Body: se omitido, default `false`. */
export function parseFecharPedidoEmAbertoBody(raw: unknown): boolean {
  if (raw === undefined || raw === null || String(raw).trim() === '') return false
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  throw createError({
    statusCode: 400,
    statusMessage: 'fechar_pedido_em_aberto inválido (true ou false).',
  })
}

/**
 * Garante que a coluna existe, não está soft-deleted e pertence ao workspace.
 */
export async function assertColunaDestinoDoWorkspace(
  admin: { from: (table: string) => any },
  workspaceId: number,
  colunaDestinoId: number,
): Promise<void> {
  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, funil_id, workspace_id')
    .eq('id', colunaDestinoId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) {
    throw createError({ statusCode: 500, statusMessage: colErr.message })
  }
  if (!coluna?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'coluna_destino_id inválida ou coluna removida.',
    })
  }

  const colWs =
    coluna.workspace_id == null || coluna.workspace_id === ''
      ? null
      : Number(coluna.workspace_id)
  if (colWs != null && Number.isFinite(colWs) && colWs === workspaceId) {
    return
  }

  const funilId =
    typeof coluna.funil_id === 'number'
      ? coluna.funil_id
      : Number.parseInt(String(coluna.funil_id ?? '').trim(), 10)
  if (!Number.isFinite(funilId) || funilId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'coluna_destino_id não pertence a este workspace.',
    })
  }

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('id', funilId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }
  if (!funil?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'coluna_destino_id não pertence a este workspace.',
    })
  }
}
