import { defineStore } from 'pinia'
import type { PageRoleRow } from '#shared/types/pageRoles'
import type {
  AdminBloqueioPageRolesResponse,
  AdminBloqueioProfileItem,
  AdminBloqueioProfilesResponse,
  AdminBloqueioTogglePageResponse,
} from '#shared/types/adminBloqueioPagina'
import { mensagemErroFetch } from '~/stores/canais'

export const useAdminBloqueioPaginaStore = defineStore('admin-bloqueio-pagina', {
  state: () => ({
    profiles: [] as AdminBloqueioProfileItem[],
    pageRoles: [] as PageRoleRow[],
    ownerUserId: null as string | null,
    pending: false,
    loaded: false,
    error: null as string | null,
    loadedWorkspaceId: null as string | null,
    /** Chaves `profileId:slug` com toggle em andamento. */
    togglingKeys: {} as Record<string, boolean>,
  }),

  getters: {
    /** Mapa `profile_id` → linha de `page_roles` (ou undefined se não houver). */
    pageRolesByProfileId(state): Map<number, PageRoleRow> {
      const map = new Map<number, PageRoleRow>()
      for (const row of state.pageRoles) {
        map.set(row.profile_id, row)
      }
      return map
    },

    /**
     * Páginas liberadas para o profile.
     * Sem linha em `page_roles` → `null` (tudo desativado).
     */
    pagesForProfile(): (profileId: number | null | undefined) => string[] | null {
      const map = this.pageRolesByProfileId
      return (profileId) => {
        if (profileId == null || !Number.isFinite(profileId) || profileId < 1) return null
        const row = map.get(profileId)
        if (!row) return null
        return row.pages
      }
    },

    /**
     * `true` se a página está em `pages`.
     * Sem linha → `false` (tudo desativado).
     */
    isPageEnabled(): (profileId: number | null | undefined, slug: string) => boolean {
      return (profileId, slug) => {
        const pages = this.pagesForProfile(profileId)
        if (pages == null) return false
        return pages.includes(slug)
      }
    },

    isToggling(): (profileId: number | null | undefined, slug: string) => boolean {
      return (profileId, slug) => {
        if (profileId == null) return false
        return Boolean(this.togglingKeys[`${profileId}:${slug}`])
      }
    },
  },

  actions: {
    upsertPageRoleLocal(row: PageRoleRow) {
      const idx = this.pageRoles.findIndex((r) => r.profile_id === row.profile_id)
      if (idx >= 0) {
        this.pageRoles[idx] = row
      } else {
        this.pageRoles.push(row)
      }
    },

    async fetchWorkspaceData(workspaceId: string, { force = false } = {}) {
      if (!force && this.loadedWorkspaceId === workspaceId && this.loaded && !this.error) {
        return
      }

      const wsId = Number.parseInt(workspaceId, 10)
      if (!Number.isFinite(wsId) || wsId < 1) {
        this.profiles = []
        this.pageRoles = []
        this.ownerUserId = null
        this.loaded = true
        this.loadedWorkspaceId = workspaceId
        this.error = 'Workspace inválido.'
        return
      }

      this.pending = true
      this.error = null

      try {
        const [profilesRes, pageRolesRes] = await Promise.all([
          $fetch<AdminBloqueioProfilesResponse>('/api/admin/bloqueio-pagina/profiles', {
            method: 'GET',
            query: { workspace_id: wsId },
          }),
          $fetch<AdminBloqueioPageRolesResponse>('/api/admin/bloqueio-pagina/page-roles', {
            method: 'GET',
            query: { workspace_id: wsId },
          }),
        ])

        this.profiles = profilesRes.items
        this.pageRoles = pageRolesRes.items
        this.ownerUserId = profilesRes.owner_user_id
        this.loaded = true
        this.loadedWorkspaceId = workspaceId
      } catch (err) {
        this.profiles = []
        this.pageRoles = []
        this.ownerUserId = null
        this.loaded = false
        this.loadedWorkspaceId = null
        this.error = mensagemErroFetch(err, 'Não foi possível carregar bloqueio de páginas.')
        throw err
      } finally {
        this.pending = false
      }
    },

    /**
     * Liga/desliga uma página para o profile.
     * Cria a linha em `page_roles` se ainda não existir.
     */
    async togglePage(payload: {
      workspaceId: number
      profileId: number
      page: string
      enabled: boolean
    }): Promise<PageRoleRow> {
      const key = `${payload.profileId}:${payload.page}`
      this.togglingKeys = { ...this.togglingKeys, [key]: true }

      try {
        const res = await $fetch<AdminBloqueioTogglePageResponse>(
          '/api/admin/bloqueio-pagina/toggle-page',
          {
            method: 'PATCH',
            body: {
              workspace_id: payload.workspaceId,
              profile_id: payload.profileId,
              page: payload.page,
              enabled: payload.enabled,
            },
          },
        )

        this.upsertPageRoleLocal(res.row)
        return res.row
      } finally {
        const next = { ...this.togglingKeys }
        delete next[key]
        this.togglingKeys = next
      }
    },

    clear() {
      this.profiles = []
      this.pageRoles = []
      this.ownerUserId = null
      this.pending = false
      this.loaded = false
      this.error = null
      this.loadedWorkspaceId = null
      this.togglingKeys = {}
    },
  },
})
