type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

/** IDs de canais ativos do workspace (para vincular logs sem `workspace_id`). */
export async function listarCanalIdsDoWorkspace(
  admin: SupabaseAdmin,
  workspaceId: number,
): Promise<number[]> {
  const { data, error } = await admin
    .from('canais')
    .select('id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)

  if (error) throw error

  return (data ?? [])
    .map((row: { id?: unknown }) => {
      const id = typeof row.id === 'number' ? row.id : Number(row.id)
      return Number.isFinite(id) && Number.isInteger(id) && id > 0 ? id : null
    })
    .filter((id): id is number => id != null)
}

export function execucaoPertenceAoWorkspace(
  row: { workspace_id?: number | null; id_canal?: number | null },
  workspaceId: number,
  canalIds: number[],
): boolean {
  if (row.workspace_id != null && Number(row.workspace_id) === workspaceId) return true
  if (row.id_canal != null && canalIds.includes(Number(row.id_canal))) return true
  return false
}
