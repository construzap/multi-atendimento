import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'
import { useMensagensStore } from '~/stores/mensagens'

/**
 * Quando o usuário seleciona uma conversa (`conversas.key`) dentro de um canal,
 * garante mensagens carregadas e zera `nao_lidas`.
 */
export default defineNuxtPlugin(() => {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const mensagens = useMensagensStore()
  const kanban = useKanbanStore()

  watch(
    [
      () => kanban.infoContatoConversaKey,
      () => kanban.infoContatoIdCanal,
      () => canais.currentCanalId,
      () => conversas.conversaAtual,
    ],
    async ([kanbanKey, kanbanCanalId, canalId, conversaKey]) => {
      if (kanbanKey != null) {
        if (!kanbanCanalId || String(kanbanKey).startsWith('temp:')) return
        await mensagens.ensureLoaded(kanbanCanalId, kanbanKey, 1, { force: true }).catch(() => {
          /* erro fica em mensagens.error */
        })
        return
      }

      if (!canalId || !conversaKey) return
      if (String(conversaKey).startsWith('temp:')) return
      await Promise.all([
        mensagens.ensureLoaded(canalId, conversaKey, 1).catch(() => {
          /* erro fica em mensagens.error */
        }),
        conversas.marcarComoLida(conversaKey).catch(() => {
          /* falha silenciosa; badge pode voltar no próximo fetch */
        }),
      ])
    },
    { immediate: true },
  )
})

