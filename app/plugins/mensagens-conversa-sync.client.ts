import { watch } from 'vue'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useMensagensStore } from '~/stores/mensagens'

/**
 * Quando o usuário seleciona uma conversa (`conversas.key`) dentro de um canal,
 * garante que as mensagens estejam carregadas (cache-first).
 */
export default defineNuxtPlugin(() => {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const mensagens = useMensagensStore()

  watch(
    [() => canais.currentCanalId, () => conversas.conversaAtual],
    async ([canalId, conversaKey]) => {
      if (!canalId || !conversaKey) return
      // Conversas temporárias (criadas no front) ainda não existem no banco.
      if (String(conversaKey).startsWith('temp:')) return
      await mensagens.ensureLoaded(canalId, conversaKey, 1).catch(() => {
        /* erro fica em mensagens.error */
      })
    },
    { immediate: true }
  )
})

