import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import type { KanbanConversaAtualizarResponse, KanbanConversaPatch } from '#shared/types/kanban'
import { mensagemErroFetch } from '../../../stores/canais'
import { useKanbanStore } from '../../../stores/kanban'

type Options = {
  conversaKey: MaybeRefOrGetter<string>
  conversaEditavel?: MaybeRefOrGetter<boolean | undefined>
  /** @deprecated use conversaEditavel */
  nomeEditavel?: MaybeRefOrGetter<boolean | undefined>
  workspaceId: MaybeRefOrGetter<number | null | undefined>
}

function resolveWorkspaceId(raw: unknown): number | null {
  const v = toValue(raw as MaybeRefOrGetter<number | null | undefined>)
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.trunc(v)
  if (typeof v === 'string' && v.trim()) {
    const n = Number.parseInt(v.trim(), 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function isEditavel(raw: unknown): boolean {
  const v = toValue(raw as MaybeRefOrGetter<boolean | undefined>)
  return v === true || v === ''
}

export function useKanbanConversaCampoEditavel(options: Options) {
  const kanbanStore = useKanbanStore()

  const podeEditar: ComputedRef<boolean> = computed(() => {
    const editavel = isEditavel(options.conversaEditavel) || isEditavel(options.nomeEditavel)
    const wid = resolveWorkspaceId(options.workspaceId)
    const key = String(toValue(options.conversaKey) ?? '').trim()
    return editavel && wid != null && key.length > 0
  })

  async function aplicarPatch(
    patch: KanbanConversaPatch,
    mensagemSucesso: string,
    extras?: { canal_nome?: string | null },
  ): Promise<KanbanConversaAtualizarResponse> {
    const wid = resolveWorkspaceId(options.workspaceId)
    const key = String(toValue(options.conversaKey) ?? '').trim()
    if (!podeEditar.value || wid == null || !key) {
      throw new Error('Edição indisponível.')
    }

    try {
      const res = await kanbanStore.atualizarConversa(wid, key, patch, extras)
      toast.success(mensagemSucesso)
      return res
    } catch (err: unknown) {
      toast.error(mensagemErroFetch(err, 'Não foi possível atualizar.'), { duration: 8000 })
      throw err
    }
  }

  return { kanbanStore, podeEditar, aplicarPatch }
}
