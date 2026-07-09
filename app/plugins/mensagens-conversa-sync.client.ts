import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'
import { useMensagensStore } from '~/stores/mensagens'

/**
 * Quando o painel de info do kanban abre uma conversa, garante mensagens carregadas.
 * Marcar como lida no chat principal ocorre ao abrir a rota `[conversaKey]`.
 */
export default defineNuxtPlugin(() => {
  const mensagens = useMensagensStore()
  const kanban = useKanbanStore()

  watch(
    [
      () => kanban.infoContatoConversaKey,
      () => kanban.infoContatoIdCanal,
    ],
    async ([kanbanKey, kanbanCanalId]) => {
      if (kanbanKey == null) return
      if (!kanbanCanalId || String(kanbanKey).startsWith('temp:')) return
      await mensagens.ensureLoaded(kanbanCanalId, kanbanKey, 1, { force: true }).catch(() => {
        /* erro fica em mensagens.error */
      })
    },
    { immediate: true },
  )
})

