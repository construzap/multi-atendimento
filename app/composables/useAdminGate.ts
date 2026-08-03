import { useProfileStore } from '~/stores/profile'

/**
 * Gate de admin seguro para SSR/hidratação.
 * Não chama a API no servidor (evita 401 sem cookies via `$fetch` e mismatch de DOM).
 * No client, verifica em `onMounted` e só então libera o conteúdo.
 */
export function useAdminGate() {
  const profile = useProfileStore()
  const ready = ref(false)

  const pending = computed(() => !ready.value || profile.adminPending)
  const isAdmin = computed(() => ready.value && profile.isAdminConfirmado)
  const erroTexto = computed(() => (ready.value ? profile.adminError : null))

  onMounted(() => {
    void (async () => {
      try {
        // Revalida no client (cookies disponíveis). Force se o SSR deixou erro de auth.
        const force = Boolean(profile.adminError)
        await profile.ensureAdminVerificado({ force })
      } catch {
        /* erro em profile.adminError */
      } finally {
        ready.value = true
      }
    })()
  })

  return { pending, isAdmin, erroTexto, ready }
}
