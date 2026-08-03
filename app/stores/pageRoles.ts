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
     * Sem `page` na query: retorna a lista completa e cacheia por `loadedKey`.
     * `fetcher` opcional (ex.: useRequestFetch) para SSR no middleware.
     */
    async checkPageRoles(options?: {
      force?: boolean
      workspaceId?: number
      profileId?: number
      fetcher?: typeof $fetch
    }) {
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

      const fetchFn = options?.fetcher ?? $fetch

      try {
        const res = await fetchFn<PageRolesCheckResponse>('/api/page-roles', {
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

    /** True se já há cache válido para o par workspace+profile. */
    isLoadedFor(workspaceId: number, profileId: number): boolean {
      return this.loadedKey === `${workspaceId}:${profileId}` && !this.error
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
