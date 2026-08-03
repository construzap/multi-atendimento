import { defineStore } from 'pinia'
import type { AdminVerificarResponse, UserProfile } from '#shared/types/profile'
import { mensagemErroFetch } from '~/stores/canais'

type ProfileState = {
  me: UserProfile | null
  pending: boolean
  error: string | null
  /** Timestamp (ms) do último GET /api/perfil/me bem sucedido. */
  loadedAt: number | null
  /** Resultado de `GET /api/admin/verificar` (`null` = ainda não checado). */
  isAdmin: boolean | null
  /** Timestamp (ms) do último GET /api/admin/verificar bem sucedido. */
  adminCheckedAt: number | null
  adminPending: boolean
  adminError: string | null
}

/**
 * No SSR, `$fetch` não encaminha cookies da requisição do browser —
 * use `useRequestFetch` para a sessão Supabase chegar nas APIs.
 */
function profileApiFetch<T>(url: string, opts?: Record<string, unknown>): Promise<T> {
  if (import.meta.server) {
    return useRequestFetch()(url, opts) as Promise<T>
  }
  return $fetch<T>(url, opts)
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    me: null,
    pending: false,
    error: null,
    loadedAt: null,
    isAdmin: null,
    adminCheckedAt: null,
    adminPending: false,
    adminError: null,
  }),
  getters: {
    /** `true` só quando a verificação já rodou e confirmou admin. */
    isAdminConfirmado(state): boolean {
      return state.isAdmin === true
    },

    /** Role do perfil carregado (`me.role`), ou `null` se ainda não há perfil. */
    role(state): UserProfile['role'] | null {
      return state.me?.role ?? null
    },
  },
  actions: {
    /** Sincroniza `isAdmin` a partir de `profiles.role` (quando disponível). */
    syncAdminFromMe() {
      const role = this.me?.role
      if (role == null) return
      this.isAdmin = role === 'ADMIN'
      this.adminCheckedAt = Date.now()
      this.adminError = null
    },

    async fetchMe() {
      this.pending = true
      this.error = null

      try {
        const data = await profileApiFetch<UserProfile>('/api/perfil/me', {
          method: 'GET',
        })
        this.me = data
        this.loadedAt = Date.now()
        this.syncAdminFromMe()
        return data
      } catch (err) {
        this.me = null
        this.loadedAt = null
        this.error = err instanceof Error ? err.message : 'Falha ao carregar perfil.'
        throw err
      } finally {
        this.pending = false
      }
    },

    /** Cache-first: só busca se o perfil ainda não foi carregado nesta sessão. */
    async ensureMeLoaded(options?: { force?: boolean }) {
      if (!options?.force && this.loadedAt != null && this.me != null) return
      await this.fetchMe()
    },

    /** GET /api/admin/verificar — grava `isAdmin` no Pinia. */
    async fetchAdminVerificar() {
      this.adminPending = true
      this.adminError = null

      try {
        const data = await profileApiFetch<AdminVerificarResponse>('/api/admin/verificar', {
          method: 'GET',
        })
        this.isAdmin = data.isAdmin === true
        this.adminCheckedAt = Date.now()
        return data
      } catch (err) {
        this.isAdmin = null
        this.adminCheckedAt = null
        this.adminError = mensagemErroFetch(err, 'Falha ao verificar perfil admin.')
        throw err
      } finally {
        this.adminPending = false
      }
    },

    /** Cache-first: só chama `/api/admin/verificar` se ainda não houver resultado nesta sessão. */
    async ensureAdminVerificado(options?: { force?: boolean }) {
      if (!options?.force && this.adminCheckedAt != null && this.isAdmin != null) return
      // Se `/api/perfil/me` já trouxe `role`, não precisa de outra chamada.
      if (!options?.force && this.me?.role != null) {
        this.syncAdminFromMe()
        return
      }
      await this.fetchAdminVerificar()
    },

    async updateMe(input: { full_name?: string | null; whatsapp?: string | null }) {
      this.pending = true
      this.error = null

      try {
        const data = await profileApiFetch<UserProfile>('/api/perfil/me', {
          method: 'PATCH',
          body: input,
        })
        this.me = data
        this.syncAdminFromMe()
        return data
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao atualizar perfil.'
        throw err
      } finally {
        this.pending = false
      }
    },

    async updatePassword(input: {
      new_password: string
      new_password_confirm: string
      revogar_outras_sessoes?: boolean
    }) {
      this.pending = true
      this.error = null

      try {
        return await profileApiFetch<{ ok: true; revogou_outras_sessoes: boolean; aviso?: string }>(
          '/api/perfil/senha',
          {
            method: 'PATCH',
            body: input,
          },
        )
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao alterar senha.'
        throw err
      } finally {
        this.pending = false
      }
    },
  },
})
