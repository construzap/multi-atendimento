import { watch } from 'vue'
import { usePageRolesStore } from '~/stores/pageRoles'
import { useProfileStore } from '~/stores/profile'
import { isRotaPublica } from '~/utils/isRotaEntregaPublica'

export default defineNuxtPlugin(() => {
  const profile = useProfileStore()
  const pageRoles = usePageRolesStore()
  const session = useSupabaseSession()
  const route = useRoute()

  async function refreshIfLoggedIn() {
    if (isRotaPublica(route.path)) return
    if (!session.value) return
    try {
      await profile.ensureMeLoaded()
    } catch {
      // erro já fica em profile.error; não quebra navegação
    }
  }

  // Ao entrar no app (recarrega/refresh de sessão)
  void refreshIfLoggedIn()

  // Após login/logout (mudança de sessão)
  watch(
    session,
    async (next) => {
      if (isRotaPublica(route.path)) return
      if (!next) {
        profile.me = null
        profile.error = null
        profile.pending = false
        profile.loadedAt = null
        pageRoles.clear()
        return
      }
      await refreshIfLoggedIn()
    },
    { immediate: false },
  )

  // Saiu da página pública de entrega → carrega perfil se estiver logado
  watch(
    () => route.path,
    (path, prev) => {
      if (isRotaPublica(path)) return
      if (prev && isRotaPublica(prev)) {
        void refreshIfLoggedIn()
      }
    },
  )
})
