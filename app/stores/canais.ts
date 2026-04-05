import { defineStore } from 'pinia'
import type { Canal } from '#shared/types/canal'

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
function mensagemErroFetch(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const payload = (err as { data?: unknown }).data
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      if (typeof p.statusMessage === 'string' && p.statusMessage.trim()) {
        return p.statusMessage
      }
      if (typeof p.message === 'string' && p.message.trim()) {
        return p.message
      }
    }
  }
  if (err instanceof Error && err.message) return err.message
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
    }
  },
  actions: {
    async fetchCanais(workspaceId: number) {
      this.listPending = true
      this.listError = null
      try {
        const data = await $fetch<Canal[]>('/api/canais', {
          method: 'GET',
          query: { workspace_id: workspaceId }
        })
        this.items = data
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

    async fetchSubscription() {
      this.subscriptionPending = true
      this.subscriptionError = null
      try {
        const data = await $fetch<CanaisSubscription>('/api/canais/subscription', { method: 'GET' })
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
          this.fetchSubscription().catch(() => {
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
    }
  }
})
