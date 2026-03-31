import { defineStore } from 'pinia'
import type { UserProfile } from '~/types/profile'

type ProfileState = {
  me: UserProfile | null
  pending: boolean
  error: string | null
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    me: null,
    pending: false,
    error: null
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
        return data
      } catch (err) {
        this.me = null
        this.error = err instanceof Error ? err.message : 'Falha ao carregar perfil.'
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})

