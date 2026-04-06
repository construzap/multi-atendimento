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
        conversas.reset()
        return
      }
      await conversas.fetchPage(1).catch(() => {
        /* erro permanece em conversas.error */
      })
    },
    { immediate: true }
  )
})
