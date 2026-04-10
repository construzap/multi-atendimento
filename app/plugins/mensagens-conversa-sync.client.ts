import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useMensagensStore } from '~/stores/mensagens'

/**
 * Quando o usuário seleciona uma conversa (lid) dentro de um canal,
 * garante que as mensagens (id_canal + lid) estejam carregadas (cache-first).
 */
export default defineNuxtPlugin(() => {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const mensagens = useMensagensStore()

  watch(
    [() => canais.currentCanalId, () => conversas.conversaAtual],
    async ([canalId, lid]) => {
      if (!canalId || !lid) return
      await mensagens.ensureLoaded(canalId, lid, 1).catch(() => {
        /* erro fica em mensagens.error */
      })
    },
    { immediate: true }
  )
})

