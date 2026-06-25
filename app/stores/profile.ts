import { defineStore } from 'pinia'
import type { UserProfile } from '#shared/types/profile'

type ProfileState = {
  me: UserProfile | null
  pending: boolean
  error: string | null
  /** Timestamp (ms) do último GET /api/perfil/me bem sucedido. */
  loadedAt: number | null
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    me: null,
    pending: false,
    error: null,
    loadedAt: null,
  }),
  actions: {
    async fetchMe() {
      this.pending = true
      this.error = null

      try {
        const data = await $fetch<UserProfile>('/api/perfil/me', {
          method: 'GET'
        })
        this.me = data
        this.loadedAt = Date.now()
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

    async updateMe(input: { full_name?: string | null; whatsapp?: string | null }) {
      this.pending = true
      this.error = null

      try {
        const data = await $fetch<UserProfile>('/api/perfil/me', {
          method: 'PATCH',
          body: input
        })
        this.me = data
        return data
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao atualizar perfil.'
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})

