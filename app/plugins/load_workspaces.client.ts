import { watch } from 'vue'
import { useWorkspacesStore } from '~/stores/workspaces'

export default defineNuxtPlugin(() => {
  const workspaces = useWorkspacesStore()
  const session = useSupabaseSession()

  async function refreshIfLoggedIn(force = false) {
    if (!session.value) return
    try {
      await workspaces.ensureAllLoaded({ force })
    } catch {
      // erro já fica em workspaces.error; não quebra navegação
    }
  }

  // Session pode atrasar um tick após o mount — watch immediate cobre login + F5.
  watch(
    session,
    async (next, prev) => {
      if (!next) {
        workspaces.items = []
        workspaces.error = null
        workspaces.pending = false
        workspaces.loadedAt = null
        workspaces.setCurrentWorkspaceId(null)
        return
      }
      // Troca de sessão (login) força refetch; F5/rehydrate só busca se ainda não carregou.
      const force = Boolean(prev === null || prev === undefined)
      await refreshIfLoggedIn(force)
    },
    { immediate: true },
  )
})
