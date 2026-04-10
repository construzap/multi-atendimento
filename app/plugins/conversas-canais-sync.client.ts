import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'

/**
 * Quando o canal atual (store `canais`) muda, recarrega a primeira página de conversas.
 * Sem isso, trocar de `/chat/2` para `/chat/6` dependeria só de outro gatilho.
 */
export default defineNuxtPlugin(() => {
  const canais = useCanaisStore()
  const conversas = useConversasStore()

  watch(
    () => canais.currentCanalId,
    async (id) => {
      if (id == null) {
        conversas.setActiveCanalId(null)
        canais.instanciaStatus = null
        canais.instanciaStatusPending = false
        canais.instanciaStatusError = null
        return
      }
      await canais.fetchInstanciaStatus(id).catch(() => {
        /* erro permanece em canais.instanciaStatusError */
      })
      // Cache-first: se já tiver no Pinia, não refaz chamada.
      await conversas.ensureLoaded(id, 1).catch(() => {
        /* erro permanece em conversas.error */
      })
    },
    { immediate: true }
  )
})
