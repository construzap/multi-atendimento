import { defineStore } from 'pinia'
import type {
  AdminAtualizarPerfilBody,
  AdminGerenciarAssinaturasResponse,
  PerfilConsolidadoRow,
} from '#shared/types/adminGerenciarAssinaturas'
import { mensagemErroFetch } from '~/stores/canais'

export const useAdminGerenciarAssinaturasStore = defineStore('admin-gerenciar-assinaturas', {
  state: () => ({
    perfil: null as PerfilConsolidadoRow | null,
    userIdCarregado: null as string | null,
    pending: false,
    salvando: false,
    loaded: false,
    error: null as string | null,
  }),

  actions: {
    clear() {
      this.perfil = null
      this.userIdCarregado = null
      this.pending = false
      this.salvando = false
      this.loaded = false
      this.error = null
    },

    async fetchPorUserId(userId: string, { force = false } = {}) {
      const id = userId.trim()
      if (!id) {
        this.clear()
        return null
      }

      if (!force && this.loaded && this.userIdCarregado === id && !this.error) {
        return this.perfil
      }

      this.pending = true
      this.error = null

      try {
        const res = await $fetch<AdminGerenciarAssinaturasResponse>(
          '/api/admin/gerenciarassinaturas',
          {
            method: 'GET',
            query: { user_id: id },
          },
        )
        this.perfil = res.perfil ?? null
        this.userIdCarregado = id
        this.loaded = true
        return this.perfil
      } catch (err) {
        this.error = mensagemErroFetch(
          err,
          'Não foi possível carregar os dados da assinatura.',
        )
        this.perfil = null
        this.userIdCarregado = id
        this.loaded = true
        throw err
      } finally {
        this.pending = false
      }
    },

    async atualizarPerfil(body: AdminAtualizarPerfilBody) {
      this.salvando = true
      this.error = null

      try {
        const res = await $fetch<AdminGerenciarAssinaturasResponse>(
          '/api/admin/gerenciarassinaturas',
          {
            method: 'POST',
            body,
          },
        )
        this.perfil = res.perfil ?? null
        this.userIdCarregado = body.user_id
        this.loaded = true
        return this.perfil
      } catch (err) {
        this.error = mensagemErroFetch(
          err,
          'Não foi possível atualizar o perfil.',
        )
        throw err
      } finally {
        this.salvando = false
      }
    },
  },
})
