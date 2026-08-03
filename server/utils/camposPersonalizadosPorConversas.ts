import type { ContatoCampoPersonalizadoResumo } from '#shared/types/contato'
import type { TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'

type SupabaseAdmin = {
  from: (table: string) => any
}

const TIPOS = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

function parseTipo(raw: unknown): TipoCampoPersonalizado {
  const s = String(raw ?? '').trim().toLowerCase()
  return TIPOS.has(s as TipoCampoPersonalizado) ? (s as TipoCampoPersonalizado) : 'text'
}

/**
 * Carrega resumos de campos personalizados (definição + valor) para várias conversas,
 * a partir de `valores_campos_personalizados` + `campos_personalizados` (não da view).
 */
export async function fetchCamposPersonalizadosPorConversas(
  admin: SupabaseAdmin,
  workspaceId: number,
  conversaKeys: string[],
): Promise<Map<string, ContatoCampoPersonalizadoResumo[]>> {
  const out = new Map<string, ContatoCampoPersonalizadoResumo[]>()
  const keys = [...new Set(conversaKeys.map((k) => k.trim()).filter(Boolean))]
  if (!keys.length || workspaceId < 1) return out

  for (const k of keys) out.set(k, [])

  const { data, error } = await admin
    .from('valores_campos_personalizados')
    .select(
      `
      conversa_key,
      valor,
      campos_personalizados!inner (
        id,
        nome,
        tipo,
        workspace_id,
        deleted_at
      )
    `,
    )
    .in('conversa_key', keys)
    .eq('campos_personalizados.workspace_id', workspaceId)

  if (error) {
    throw error
  }

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const conversaKey = String(row.conversa_key ?? '').trim()
    if (!conversaKey) continue

    const cpRaw = row.campos_personalizados
    const cp = Array.isArray(cpRaw)
      ? (cpRaw[0] as Record<string, unknown> | undefined)
      : (cpRaw as Record<string, unknown> | null)

    if (!cp || cp.deleted_at != null) continue

    const id = typeof cp.id === 'number' ? cp.id : Number(cp.id)
    if (!Number.isFinite(id) || id < 1) continue

    const nome = String(cp.nome ?? '').trim()
    if (!nome) continue

    const valorRaw = row.valor
    const item: ContatoCampoPersonalizadoResumo = {
      id,
      nome,
      tipo: parseTipo(cp.tipo),
      valor: valorRaw === null || valorRaw === undefined ? null : String(valorRaw),
    }

    const lista = out.get(conversaKey) ?? []
    lista.push(item)
    out.set(conversaKey, lista)
  }

  for (const [k, lista] of out) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
    out.set(k, lista)
  }

  return out
}

/** Uma conversa — atalho sobre o batch. */
export async function fetchCamposPersonalizadosDaConversa(
  admin: SupabaseAdmin,
  workspaceId: number,
  conversaKey: string,
): Promise<ContatoCampoPersonalizadoResumo[]> {
  const map = await fetchCamposPersonalizadosPorConversas(admin, workspaceId, [conversaKey])
  return map.get(conversaKey.trim()) ?? []
}
