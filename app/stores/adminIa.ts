import { defineStore } from 'pinia'
import type { AdminCanalIa, AdminPerfilIaLimites } from '#shared/types/adminIa'
import { mensagemErroFetch } from '~/stores/canais'

const fetchCanaisEmCurso = new Map<string, Promise<AdminCanalIa[]>>()

type CanaisCacheEntry = {
  items: AdminCanalIa[]
  ownerUserId: string | null
  loaded: boolean
}

function ownerUserIdDoWorkspace(workspaceId: string): string | null {
  const adminStore = useAdminStore()
  const ws = adminStore.workspaces.find((w) => String(w.id) === workspaceId)
  return ws?.user_id?.trim() || null
}

export const useAdminIaStore = defineStore('admin-ia', {
  state: () => ({
    canaisPorWorkspace: {} as Record<string, CanaisCacheEntry>,
    canaisPendingPorWorkspace: {} as Record<string, boolean>,
    canaisErrorPorWorkspace: {} as Record<string, string | null>,
    canalIaSalvandoIds: {} as Record<string, boolean>,
    limiteIasSalvando: false,
    /** Limites de I.A por dono do workspace (`user_id` do perfil). */
    perfilIaPorUserId: {} as Record<string, AdminPerfilIaLimites>,
  }),

  getters: {
    canaisCacheAtual(): CanaisCacheEntry | null {
      const adminStore = useAdminStore()
      const id = adminStore.selectedWorkspaceId
      if (!id) return null
      return this.canaisPorWorkspace[id] ?? null
    },

    canaisItens(): AdminCanalIa[] {
      const cache = this.canaisCacheAtual
      if (!cache?.loaded) return []
      return cache.items
    },

    canaisPending(): boolean {
      const adminStore = useAdminStore()
      const id = adminStore.selectedWorkspaceId
      if (!id) return false
      return Boolean(this.canaisPendingPorWorkspace[id])
    },

    canaisLoaded(): boolean {
      return Boolean(this.canaisCacheAtual?.loaded)
    },

    canaisError(): string | null {
      const adminStore = useAdminStore()
      const id = adminStore.selectedWorkspaceId
      if (!id) return null
      return this.canaisErrorPorWorkspace[id] ?? null
    },

    perfilIaAtual(): AdminPerfilIaLimites | null {
      const adminStore = useAdminStore()
      const wsId = adminStore.selectedWorkspaceId
      if (!wsId) return null

      const ownerUserId = ownerUserIdDoWorkspace(wsId)
      if (!ownerUserId) return null

      return this.perfilIaPorUserId[ownerUserId] ?? null
    },

    limiteIas(): number | null {
      return this.perfilIaAtual?.limite_ias ?? null
    },

    iasAtreladas(): number {
      return this.perfilIaAtual?.ias_atreladas ?? 0
    },

    totalComIa(): number {
      return this.canaisItens.filter((c) => c.tem_inteligencia_artificial).length
    },

    canalIaSalvando() {
      return (canalId: number): boolean => {
        const adminStore = useAdminStore()
        const workspaceId = adminStore.selectedWorkspaceId
        if (!workspaceId) return false
        return Boolean(this.canalIaSalvandoIds[`${workspaceId}:${canalId}`])
      }
    },
  },

  actions: {
    chaveCanalSalvando(workspaceId: string, canalId: number) {
      return `${workspaceId}:${canalId}`
    },

    definirPerfilIa(perfil: AdminPerfilIaLimites) {
      this.perfilIaPorUserId = {
        ...this.perfilIaPorUserId,
        [perfil.user_id]: perfil,
      }
    },

    ajustarIasAtreladasNoPerfil(userId: string, delta: number) {
      const perfil = this.perfilIaPorUserId[userId]
      if (!perfil) return

      this.perfilIaPorUserId = {
        ...this.perfilIaPorUserId,
        [userId]: {
          ...perfil,
          ias_atreladas: Math.max(0, perfil.ias_atreladas + delta),
        },
      }
    },

    definirCanalIaNoCache(workspaceId: string, canal: AdminCanalIa) {
      const cache = this.canaisPorWorkspace[workspaceId]
      if (!cache?.loaded) return

      const items = cache.items.map((c) => (c.id === canal.id ? canal : c))
      this.canaisPorWorkspace[workspaceId] = { ...cache, items }
    },

    /**
     * Carrega canais do workspace apenas se ainda não estiverem no cache.
     */
    async fetchCanaisSeNecessario(workspaceId: string | null): Promise<AdminCanalIa[]> {
      if (!workspaceId) return []

      const cache = this.canaisPorWorkspace[workspaceId]
      if (cache?.loaded) {
        return cache.items
      }

      const emCurso = fetchCanaisEmCurso.get(workspaceId)
      if (emCurso) {
        return emCurso
      }

      const ownerUserId = ownerUserIdDoWorkspace(workspaceId)
      if (!ownerUserId) {
        throw new Error('Dono do workspace não encontrado. Recarregue a lista de workspaces.')
      }

      this.canaisPendingPorWorkspace[workspaceId] = true
      this.canaisErrorPorWorkspace[workspaceId] = null

      const promise = (async (): Promise<AdminCanalIa[]> => {
        try {
          const data = await $fetch<{
            items: AdminCanalIa[]
            perfil: AdminPerfilIaLimites
          }>('/api/admin/ia/canais', {
            method: 'GET',
            query: {
              workspace_id: workspaceId,
              owner_user_id: ownerUserId,
            },
          })

          this.definirPerfilIa(data.perfil)

          this.canaisPorWorkspace[workspaceId] = {
            items: data.items,
            ownerUserId: data.perfil.user_id,
            loaded: true,
          }

          return data.items
        } catch (err) {
          this.canaisPorWorkspace[workspaceId] = {
            items: [],
            ownerUserId,
            loaded: false,
          }
          this.canaisErrorPorWorkspace[workspaceId] = mensagemErroFetch(
            err,
            'Não foi possível carregar os canais.',
          )
          throw err
        } finally {
          this.canaisPendingPorWorkspace[workspaceId] = false
        }
      })()

      fetchCanaisEmCurso.set(workspaceId, promise)
      try {
        return await promise
      } finally {
        fetchCanaisEmCurso.delete(workspaceId)
      }
    },

    async recarregarCanais(workspaceId: string | null): Promise<AdminCanalIa[]> {
      if (!workspaceId) return []
      this.invalidarCanais(workspaceId)
      return this.fetchCanaisSeNecessario(workspaceId)
    },

    invalidarCanais(workspaceId?: string) {
      if (workspaceId) {
        fetchCanaisEmCurso.delete(workspaceId)
        const next = { ...this.canaisPorWorkspace }
        delete next[workspaceId]
        this.canaisPorWorkspace = next
        this.canaisErrorPorWorkspace[workspaceId] = null
        return
      }

      fetchCanaisEmCurso.clear()
      this.canaisPorWorkspace = {}
      this.canaisPendingPorWorkspace = {}
      this.canaisErrorPorWorkspace = {}
    },

    async atualizarLimiteIas(limiteIas: number): Promise<AdminPerfilIaLimites> {
      const perfil = this.perfilIaAtual
      if (!perfil?.user_id) {
        throw new Error('Perfil não carregado. Selecione um workspace.')
      }

      if (!Number.isInteger(limiteIas) || limiteIas < 0) {
        throw new Error('Informe um limite de I.A válido (inteiro ≥ 0).')
      }

      this.limiteIasSalvando = true
      try {
        const atualizado = await $fetch<AdminPerfilIaLimites>('/api/admin/ia/perfil/limite-ias', {
          method: 'PATCH',
          body: {
            user_id: perfil.user_id,
            limite_ias: limiteIas,
          },
        })

        this.definirPerfilIa(atualizado)
        return atualizado
      } finally {
        this.limiteIasSalvando = false
      }
    },

    async alternarIaCanal(canalId: number) {
      const adminStore = useAdminStore()
      const workspaceId = adminStore.selectedWorkspaceId
      if (!workspaceId) {
        throw new Error('Selecione um workspace na barra lateral.')
      }

      const cache = this.canaisPorWorkspace[workspaceId]
      if (!cache?.loaded) return

      const canal = cache.items.find((c) => c.id === canalId)
      if (!canal) return

      const chave = this.chaveCanalSalvando(workspaceId, canalId)
      if (this.canalIaSalvandoIds[chave]) return

      const valorAnterior = canal.tem_inteligencia_artificial
      const novoValor = !valorAnterior
      const ownerUserId = cache.ownerUserId ?? ownerUserIdDoWorkspace(workspaceId)

      this.definirCanalIaNoCache(workspaceId, { ...canal, tem_inteligencia_artificial: novoValor })
      this.canalIaSalvandoIds = { ...this.canalIaSalvandoIds, [chave]: true }

      try {
        const atualizado = await $fetch<AdminCanalIa>('/api/admin/ia/canais', {
          method: 'PATCH',
          body: {
            workspace_id: workspaceId,
            id: canalId,
            tem_inteligencia_artificial: novoValor,
          },
        })

        this.definirCanalIaNoCache(workspaceId, atualizado)

        if (ownerUserId) {
          this.ajustarIasAtreladasNoPerfil(ownerUserId, novoValor ? 1 : -1)
        }
      } catch (err) {
        this.definirCanalIaNoCache(workspaceId, { ...canal, tem_inteligencia_artificial: valorAnterior })
        throw err
      } finally {
        const next = { ...this.canalIaSalvandoIds }
        delete next[chave]
        this.canalIaSalvandoIds = next
      }
    },
  },
})
