import { defineStore } from 'pinia'
import type { PageRoleRow, PageRolesCheckResponse } from '#shared/types/pageRoles'
import { mensagemErroFetch } from '~/stores/canais'
import { useProfileStore } from '~/stores/profile'
import { useWorkspacesStore } from '~/stores/workspaces'

type PageRolesState = {
  pages: string[]
  row: PageRoleRow | null
  pending: boolean
  error: string | null
  /** Par workspace+profile da última carga bem-sucedida. */
  loadedKey: string | null
}

function parsePositiveId(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

export const usePageRolesStore = defineStore('pageRoles', {
  state: (): PageRolesState => ({
    pages: [],
    row: null,
    pending: false,
    error: null,
    loadedKey: null,
  }),
  getters: {
    /** Set para checagem rápida no menu/rotas. */
    pagesSet(state): Set<string> {
      return new Set(state.pages)
    },
  },
  actions: {
    /**
     * Busca `page_roles` com `workspace_id` (Pinia workspaces) e `profile_id` (Pinia profile).
     * Retorna a lista de slugs de página liberados.
     */
    async checkPageRoles(options?: { force?: boolean; workspaceId?: number; profileId?: number }) {
      const workspaces = useWorkspacesStore()
      const profile = useProfileStore()

      await profile.ensureMeLoaded()

      const workspaceId =
        options?.workspaceId ??
        parsePositiveId(workspaces.currentWorkspaceId)

      const profileId =
        options?.profileId ??
        parsePositiveId(profile.me?.id)

      if (workspaceId == null || profileId == null) {
        this.pages = []
        this.row = null
        this.loadedKey = null
        this.error =
          workspaceId == null
            ? 'Workspace atual não definido.'
            : 'Perfil sem id carregado.'
        return [] as string[]
      }

      const key = `${workspaceId}:${profileId}`
      if (!options?.force && this.loadedKey === key && !this.error) {
        return this.pages
      }

      this.pending = true
      this.error = null

      try {
        const res = await $fetch<PageRolesCheckResponse>('/api/page-roles', {
          method: 'GET',
          query: {
            workspace_id: workspaceId,
            profile_id: profileId,
          },
        })

        this.pages = res.pages ?? []
        this.row = res.row ?? null
        this.loadedKey = key
        return this.pages
      } catch (err) {
        this.pages = []
        this.row = null
        this.loadedKey = null
        this.error = mensagemErroFetch(err, 'Não foi possível carregar permissões de páginas.')
        throw err
      } finally {
        this.pending = false
      }
    },

    hasPage(slug: string): boolean {
      return this.pagesSet.has(slug)
    },

    clear() {
      this.pages = []
      this.row = null
      this.pending = false
      this.error = null
      this.loadedKey = null
    },
  },
})
