import { watch } from 'vue'
import { useProfileStore } from '~/stores/profile'

export default defineNuxtPlugin(() => {
  const profile = useProfileStore()
  const session = useSupabaseSession()

  async function refreshIfLoggedIn() {
    if (!session.value) return
    try {
      await profile.fetchMe()
    } catch {
      // erro já fica em profile.error; não quebra navegação
    }
  }

  // Ao entrar no app (recarrega/refresh de sessão)
  refreshIfLoggedIn()

  // Após login/logout (mudança de sessão)
  watch(
    session,
    async (next) => {
      if (!next) {
        profile.me = null
        profile.error = null
        profile.pending = false
        return
      }
      await refreshIfLoggedIn()
    },
    { immediate: false }
  )
})

