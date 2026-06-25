import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'

/**
 * Quando o canal atual (store `canais`) muda, garante status da instância e lista de conversas.
 * Usa cache Pinia (`ensure*`) para não refazer GET ao voltar para um canal já carregado.
 */
export default defineNuxtPlugin(() => {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const kanban = useKanbanStore()

  watch(
    () => canais.currentCanalId,
    async (id) => {
      if (kanban.infoContatoConversaKey != null) return

      if (id == null) {
        conversas.setActiveCanalId(null)
        canais.instanciaStatus = null
        canais.instanciaStatusCanalIdLoaded = null
        canais.instanciaStatusPending = false
        canais.instanciaStatusError = null
        return
      }
      await canais.ensureInstanciaStatusLoaded(id).catch(() => {
        /* erro permanece em canais.instanciaStatusError */
      })
      await conversas.ensureLoaded(id, 1).catch(() => {
        /* erro permanece em conversas.error */
      })
    },
    { immediate: true }
  )
})
