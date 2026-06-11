import { defineStore } from 'pinia'
import type { Canal } from '#shared/types/canal'
import type { InstanciaStatus } from '#shared/types/instanciaStatus'

/** Resposta de POST /api/canais/editarcanal (mesma forma da listagem GET). */
export type CanalAtualizado = Canal

/** Resposta de POST /api/canais/criarcanal */
export type CanalCriado = {
  id: number
  workspace_id: number
  user_id: string
  nome: string | null
  descricao: string | null
  created_at: string
}

/** Resposta de GET /api/canais/subscription (alinhado a `checkSubscription`) */
export type CanaisSubscription = {
  status_assinatura: string
  canais: number | null
  canais_criados: number | null
}

type CanaisState = {
  pending: boolean
  error: string | null
  /** Lista do workspace atual (GET /api/canais) */
  items: Canal[]
  listPending: boolean
  listError: string | null
  /** Canal em foco na UI (ex.: rota `/chat/:canalId`). `null` = nenhum. */
  currentCanal: Canal | null
  /** Status da conexão (Uazapi) do canal atual. */
  instanciaStatus: InstanciaStatus | null
  instanciaStatusPending: boolean
  instanciaStatusError: string | null
  subscription: CanaisSubscription | null
  subscriptionPending: boolean
  subscriptionError: string | null
}

function normalizeStatus(s: string) {
  return s.trim().toLowerCase()
}

/**
 * Erros do Nitro expõem texto completo no JSON (`statusMessage`).
 * O `FetchError.message` do ofetch usa `response.statusText`, que o H3 preenche com
 * `sanitizeStatusMessage` (apenas tab + ASCII imprimível), removendo acentos.
 * @see https://github.com/unjs/h3 — `sanitizeStatusMessage`, `sendError`
 */
export function mensagemErroFetch(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const root = err as Record<string, unknown>
    const payload = root.data
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      if (typeof p.statusMessage === 'string' && p.statusMessage.trim()) {
        return p.statusMessage
      }
      if (typeof p.message === 'string' && p.message.trim()) {
        return p.message
      }
    }
    if (typeof root.statusMessage === 'string' && root.statusMessage.trim()) {
      return root.statusMessage
    }
    if (
      typeof root.message === 'string' &&
      root.message.trim() &&
      !root.message.startsWith('[')
    ) {
      return root.message
    }
  }
  if (err instanceof Error && err.message && !err.message.startsWith('[')) {
    return err.message
  }
  return fallback
}

/** Mesma regra do servidor em `criarcanal.post.ts` (UX pré-envio). */
export function podeCriarCanal(sub: CanaisSubscription | null): boolean {
  if (!sub) return false
  const status = normalizeStatus(sub.status_assinatura)
  if (status === 'pendente' || status === 'cancelado') return false
  const limite = sub.canais
  if (limite == null || !Number.isFinite(Number(limite))) return false
  const criados = sub.canais_criados ?? 0
  return criados < Number(limite)
}

/** Mensagem para desabilitar o botão / orientar o usuário (espelha respostas 403 do servidor). */
export function motivoBloqueioCriarCanal(sub: CanaisSubscription | null): string | null {
  if (!sub) return null
  const status = normalizeStatus(sub.status_assinatura)
  if (status === 'pendente' || status === 'cancelado') {
    return 'Sua assinatura não permite criar canais neste momento. Regularize ou renove o plano para continuar.'
  }
  const limite = sub.canais
  if (limite == null || !Number.isFinite(Number(limite))) {
    return 'Limite de canais não está configurado para seu perfil.'
  }
  const maxCanais = Number(limite)
  const criados = sub.canais_criados ?? 0
  if (criados < maxCanais) return null
  if (status === 'trial') {
    return 'Você atingiu o limite de canais do período de trial. Faça upgrade do plano para criar mais canais.'
  }
  return 'Limite de canais do seu plano atingido.'
}

export const useCanaisStore = defineStore('canais', {
  state: (): CanaisState => ({
    pending: false,
    error: null,
    items: [],
    listPending: false,
    listError: null,
    currentCanal: null,
    instanciaStatus: null,
    instanciaStatusPending: false,
    instanciaStatusError: null,
    subscription: null,
    subscriptionPending: false,
    subscriptionError: null
  }),
  getters: {
    canCreateCanal(state): boolean {
      return podeCriarCanal(state.subscription)
    },
    createBlockedReason(state): string | null {
      return motivoBloqueioCriarCanal(state.subscription)
    },
    /** Id do canal atual (atalho para `currentCanal?.id`). */
    currentCanalId(state): number | null {
      return state.currentCanal?.id ?? null
    }
  },
  actions: {
    async fetchInstanciaStatus(canalId?: number) {
      const id = canalId ?? this.currentCanalId
      if (!id) return null

      this.instanciaStatusPending = true
      this.instanciaStatusError = null
      try {
        const data = await $fetch<InstanciaStatus>('/api/canais/statusInstancia', {
          method: 'GET',
          query: { id_canal: id }
        })
        this.instanciaStatus = data
        return data
      } catch (err) {
        this.instanciaStatus = null
        this.instanciaStatusError = mensagemErroFetch(err, 'Não foi possível verificar o status da instância.')
        throw err
      } finally {
        this.instanciaStatusPending = false
      }
    },

    async desconectarInstancia(canalId?: number) {
      const id = canalId ?? this.currentCanalId
      if (!id) return

      // Mantém a UX responsiva: limpa imediatamente para refletir na UI.
      this.instanciaStatus = null
      this.instanciaStatusError = null

      await $fetch<{ response: string }>('/api/canais/desconectar', {
        method: 'POST',
        body: { id_canal: id }
      }).catch((err) => {
        this.instanciaStatusError = mensagemErroFetch(err, 'Não foi possível desconectar a instância.')
        throw err
      })
    },

    /** Define o canal em foco com o objeto completo (ex.: clique na lista ou após fetch). */
    setCurrentCanal(canal: Canal | null) {
      this.currentCanal = canal
    },
    /**
     * Define o canal apenas pelo id: usa `items` quando o canal já está na lista.
     * Se não houver correspondência, zera o atual (evita objeto incompleto).
     */
    setCurrentCanalId(id: number | null) {
      if (id == null) {
        this.currentCanal = null
        return
      }
      const found = this.items.find((c) => c.id === id)
      this.currentCanal = found ?? null
    },
    async fetchCanais(workspaceId: number) {
      this.listPending = true
      this.listError = null
      try {
        const data = await $fetch<Canal[]>('/api/canais', {
          method: 'GET',
          query: { workspace_id: workspaceId }
        })
        this.items = data
        if (this.currentCanal) {
          const match = data.find((c) => c.id === this.currentCanal!.id)
          this.currentCanal = match ?? null
        }
        return data
      } catch (err) {
        this.items = []
        this.listError = mensagemErroFetch(
          err,
          'Não foi possível carregar os canais.'
        )
        throw err
      } finally {
        this.listPending = false
      }
    },

    async fetchSubscription(workspaceId: number) {
      this.subscriptionPending = true
      this.subscriptionError = null
      try {
        const data = await $fetch<CanaisSubscription>('/api/canais/subscription', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        this.subscription = data
        return data
      } catch (err) {
        this.subscription = null
        this.subscriptionError = mensagemErroFetch(
          err,
          'Não foi possível carregar dados da assinatura.'
        )
        throw err
      } finally {
        this.subscriptionPending = false
      }
    },

    async create(input: {
      nome: string
      descricao?: string | null
      workspace_id: number
    }): Promise<CanalCriado> {
      this.pending = true
      this.error = null

      try {
        const created = await $fetch<CanalCriado>('/api/canais/criarcanal', {
          method: 'POST',
          body: {
            nome: input.nome,
            descricao: input.descricao ?? null,
            workspace_id: input.workspace_id
          }
        })
        await Promise.all([
          this.fetchCanais(input.workspace_id).catch(() => {
            /* lista pode falhar sem invalidar o canal criado */
          }),
          this.fetchSubscription(input.workspace_id).catch(() => {
            /* contagem pode falhar sem invalidar o canal criado */
          })
        ])
        return created
      } catch (err) {
        this.error = mensagemErroFetch(err, 'Falha ao criar canal.')
        throw err
      } finally {
        this.pending = false
      }
    },

    async updateCanal(input: {
      id_canal: number
      workspace_id: number
      nome: string
      descricao?: string | null
    }): Promise<CanalAtualizado> {
      this.pending = true
      this.error = null

      try {
        const updated = await $fetch<CanalAtualizado>('/api/canais/editarcanal', {
          method: 'POST',
          body: {
            id_canal: input.id_canal,
            workspace_id: input.workspace_id,
            nome: input.nome,
            descricao: input.descricao ?? null
          }
        })

        const idx = this.items.findIndex((c) => c.id === updated.id)
        if (idx !== -1) {
          this.items[idx] = { ...this.items[idx], ...updated }
        }
        if (this.currentCanal?.id === updated.id) {
          this.currentCanal = { ...this.currentCanal, ...updated }
        }
        return updated
      } catch (err) {
        this.error = mensagemErroFetch(err, 'Falha ao atualizar canal.')
        throw err
      } finally {
        this.pending = false
      }
    },

    /**
     * Remove o canal (Uazapi + soft delete). Atualiza lista, canal atual e assinatura.
     */
    async deleteCanal(id_canal: number, workspace_id: number): Promise<void> {
      this.pending = true
      this.error = null

      try {
        await $fetch<{ ok: true; id: number }>('/api/canais/deletarcanal', {
          method: 'POST',
          body: { id_canal }
        })

        this.items = this.items.filter((c) => c.id !== id_canal)
        if (this.currentCanal?.id === id_canal) {
          this.currentCanal = null
          this.instanciaStatus = null
          this.instanciaStatusError = null
        }
        await this.fetchSubscription(workspace_id).catch(() => {
          /* contagem opcional */
        })
      } catch (err) {
        this.error = mensagemErroFetch(err, 'Falha ao remover canal.')
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})
