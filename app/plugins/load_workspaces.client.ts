import { watch } from 'vue'
import { useWorkspacesStore } from '~/stores/workspaces'

export default defineNuxtPlugin(() => {
  const workspaces = useWorkspacesStore()
  const session = useSupabaseSession()

  async function refreshIfLoggedIn() {
    if (!session.value) return
    try {
      await workspaces.fetchAll()
    } catch {
      // erro já fica em workspaces.error; não quebra navegação
    }
  }

  // Ao entrar no app (recarrega/refresh de sessão)
  refreshIfLoggedIn()

  // Após login/logout (mudança de sessão)
  watch(
    session,
    async (next) => {
      if (!next) {
        workspaces.items = []
        workspaces.error = null
        workspaces.pending = false
        workspaces.setCurrentWorkspaceId(null)
        return
      }
      await refreshIfLoggedIn()
    },
    { immediate: false }
  )
})

