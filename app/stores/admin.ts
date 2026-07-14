import { defineStore } from 'pinia'
import type {
  AdminAtualizarLimiteProdutosResponse,
  AdminEmpresaRow,
  AdminWorkspace,
} from '#shared/types/admin'
import type { AdminPromptListResponse, PromptWorkspaceComPrincipal } from '#shared/types/adminPrompt'
import { PROMPT_WORKSPACE_TIPO_DEFAULT } from '#shared/types/adminPrompt'
import type { AdminPromptItem } from '~/components/admin/prompt/types'
import { mensagemErroFetch } from '~/stores/canais'

let fetchWorkspacesEmCurso: Promise<AdminWorkspace[]> | null = null
const fetchPromptsEmCurso = new Map<string, Promise<PromptWorkspaceComPrincipal[]>>()

type PromptsCacheEntry = {
  items: PromptWorkspaceComPrincipal[]
  promptPrincipalId: number | null
  loaded: boolean
}

function mapPromptParaItem(p: PromptWorkspaceComPrincipal): AdminPromptItem {
  return {
    id: String(p.id),
    titulo: p.nome,
    conteudo: p.prompt,
    tipo: p.tipo || PROMPT_WORKSPACE_TIPO_DEFAULT,
    principal: p.principal,
    atualizadoEm: p.updated_at,
  }
}

function criarPromptNovoLocal(): AdminPromptItem {
  return {
    id: '',
    titulo: '',
    conteudo: '',
    tipo: PROMPT_WORKSPACE_TIPO_DEFAULT,
    principal: false,
    atualizadoEm: '',
    isNovo: true,
  }
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    workspaces: [] as AdminWorkspace[],
    workspacesLoaded: false,
    workspacesPending: false,
    workspacesError: null as string | null,
    selectedWorkspaceId: null as string | null,
    promptsPorWorkspace: {} as Record<string, PromptsCacheEntry>,
    promptsPendingPorWorkspace: {} as Record<string, boolean>,
    promptsErrorPorWorkspace: {} as Record<string, string | null>,
    /** `null` = modal fechado; `'novo'` = criando; id = editando */
    promptEmEdicaoId: null as string | null,
    promptSalvando: false,
    limiteProdutosSalvando: false,
  }),

  getters: {
    workspaceSeletorRows: (state): AdminEmpresaRow[] =>
      state.workspaces.map((w) => ({
        id: String(w.id),
        name: w.nome,
        user_id: w.user_id,
        instance_count: 0,
      })),

    workspaceSelecionado(state): AdminWorkspace | null {
      const id = state.selectedWorkspaceId
      if (!id) return null
      return state.workspaces.find((w) => String(w.id) === id) ?? null
    },

    limiteProdutosAtual(): number | null {
      return this.workspaceSelecionado?.limite_produtos ?? null
    },

    promptsCacheAtual: (state): PromptsCacheEntry | null => {
      const id = state.selectedWorkspaceId
      if (!id) return null
      return state.promptsPorWorkspace[id] ?? null
    },

    promptItens(state): AdminPromptItem[] {
      const cache = this.promptsCacheAtual
      if (!cache?.loaded) return []
      return cache.items.map(mapPromptParaItem)
    },

    promptsPending(state): boolean {
      const id = state.selectedWorkspaceId
      if (!id) return false
      return Boolean(state.promptsPendingPorWorkspace[id])
    },

    promptsLoaded(): boolean {
      return Boolean(this.promptsCacheAtual?.loaded)
    },

    promptsError(state): string | null {
      const id = state.selectedWorkspaceId
      if (!id) return null
      return state.promptsErrorPorWorkspace[id] ?? null
    },

    promptModalAberto: (state) => state.promptEmEdicaoId !== null,

    promptEmEdicao(state): AdminPromptItem | null {
      if (state.promptEmEdicaoId === null) return null
      if (state.promptEmEdicaoId === 'novo') return criarPromptNovoLocal()

      const cache = this.promptsCacheAtual
      const item = cache?.items.find((p) => String(p.id) === state.promptEmEdicaoId)
      return item ? mapPromptParaItem(item) : null
    },
  },

  actions: {
    setSelectedWorkspaceId(id: string | null) {
      this.selectedWorkspaceId = id
      this.promptEmEdicaoId = null
    },

    async fetchWorkspacesSeNecessario(): Promise<AdminWorkspace[]> {
      if (this.workspacesLoaded) {
        return this.workspaces
      }

      if (fetchWorkspacesEmCurso) {
        return fetchWorkspacesEmCurso
      }

      this.workspacesPending = true
      this.workspacesError = null

      const promise = (async (): Promise<AdminWorkspace[]> => {
        try {
          const data = await $fetch<AdminWorkspace[]>('/api/admin/puxawokspaces', { method: 'GET' })
          this.workspaces = data
          this.workspacesLoaded = true
          return data
        } catch (err) {
          this.workspacesError = mensagemErroFetch(err, 'Não foi possível carregar os workspaces.')
          throw err
        } finally {
          this.workspacesPending = false
        }
      })()

      fetchWorkspacesEmCurso = promise
      try {
        return await promise
      } finally {
        fetchWorkspacesEmCurso = null
      }
    },

    invalidarWorkspaces() {
      fetchWorkspacesEmCurso = null
      this.workspaces = []
      this.workspacesLoaded = false
      this.workspacesError = null
    },

    /**
     * Carrega prompts do workspace apenas se ainda não estiverem no cache.
     */
    async fetchPromptsSeNecessario(workspaceId: string | null): Promise<PromptWorkspaceComPrincipal[]> {
      if (!workspaceId) return []

      const cache = this.promptsPorWorkspace[workspaceId]
      if (cache?.loaded) {
        return cache.items
      }

      const emCurso = fetchPromptsEmCurso.get(workspaceId)
      if (emCurso) {
        return emCurso
      }

      this.promptsPendingPorWorkspace[workspaceId] = true
      this.promptsErrorPorWorkspace[workspaceId] = null

      const promise = (async (): Promise<PromptWorkspaceComPrincipal[]> => {
        try {
          const data = await $fetch<AdminPromptListResponse>('/api/admin/prompt', {
            method: 'GET',
            query: { workspace_id: workspaceId },
          })

          this.promptsPorWorkspace[workspaceId] = {
            items: data.items,
            promptPrincipalId: data.prompt_principal_id,
            loaded: true,
          }

          return data.items
        } catch (err) {
          this.promptsPorWorkspace[workspaceId] = {
            items: [],
            promptPrincipalId: null,
            loaded: false,
          }
          this.promptsErrorPorWorkspace[workspaceId] = mensagemErroFetch(
            err,
            'Não foi possível carregar os prompts.',
          )
          throw err
        } finally {
          this.promptsPendingPorWorkspace[workspaceId] = false
        }
      })()

      fetchPromptsEmCurso.set(workspaceId, promise)
      try {
        return await promise
      } finally {
        fetchPromptsEmCurso.delete(workspaceId)
      }
    },

    /** Força nova busca após criar/editar/excluir. */
    async recarregarPrompts(workspaceId: string | null): Promise<PromptWorkspaceComPrincipal[]> {
      if (!workspaceId) return []
      this.invalidarPrompts(workspaceId)
      return this.fetchPromptsSeNecessario(workspaceId)
    },

    invalidarPrompts(workspaceId?: string) {
      if (workspaceId) {
        fetchPromptsEmCurso.delete(workspaceId)
        const next = { ...this.promptsPorWorkspace }
        delete next[workspaceId]
        this.promptsPorWorkspace = next
        this.promptsErrorPorWorkspace[workspaceId] = null
        return
      }

      fetchPromptsEmCurso.clear()
      this.promptsPorWorkspace = {}
      this.promptsPendingPorWorkspace = {}
      this.promptsErrorPorWorkspace = {}
    },

    abrirModalPromptNovo() {
      if (!this.selectedWorkspaceId) return
      this.promptEmEdicaoId = 'novo'
    },

    abrirModalPrompt(id: string) {
      this.promptEmEdicaoId = id
    },

    fecharModalPrompt() {
      this.promptEmEdicaoId = null
    },

    async salvarPrompt(payload: { titulo: string; conteudo: string; principal: boolean; tipo: string }) {
      const ws = this.selectedWorkspaceId
      if (!ws) {
        throw new Error('Selecione um workspace na barra lateral.')
      }

      const wsId = Number.parseInt(ws, 10)
      if (!Number.isFinite(wsId) || wsId < 1) {
        throw new Error('Workspace inválido.')
      }

      if (!payload.conteudo.trim()) {
        throw new Error('Informe o conteúdo do prompt.')
      }

      const isNovo = this.promptEmEdicaoId === 'novo'
      const promptAtual = this.promptEmEdicao
      const eraPrincipal = Boolean(promptAtual?.principal)

      const tipo = payload.tipo.trim() || PROMPT_WORKSPACE_TIPO_DEFAULT

      this.promptSalvando = true
      try {
        if (isNovo) {
          const criado = await $fetch<PromptWorkspaceComPrincipal>('/api/admin/prompt/criar', {
            method: 'POST',
            body: {
              workspace_id: wsId,
              nome: payload.titulo,
              prompt: payload.conteudo,
              tipo,
            },
          })

          if (payload.principal) {
            await $fetch<PromptWorkspaceComPrincipal>('/api/admin/prompt/tornar-principal', {
              method: 'POST',
              body: { workspace_id: wsId, id: criado.id },
            })
          }
        } else {
          const promptId = Number.parseInt(this.promptEmEdicaoId ?? '', 10)
          let definirPrincipal: boolean | undefined

          if (payload.principal) {
            definirPrincipal = true
          } else if (eraPrincipal) {
            definirPrincipal = false
          }

          await $fetch<PromptWorkspaceComPrincipal>('/api/admin/prompt/atualizar', {
            method: 'PATCH',
            body: {
              workspace_id: wsId,
              id: promptId,
              nome: payload.titulo,
              prompt: payload.conteudo,
              tipo,
              definir_principal: definirPrincipal,
            },
          })
        }

        await this.recarregarPrompts(ws)
        this.fecharModalPrompt()
        return isNovo
      } finally {
        this.promptSalvando = false
      }
    },

    async excluirPromptAtual() {
      const ws = this.selectedWorkspaceId
      const id = this.promptEmEdicaoId

      if (!ws || !id || id === 'novo') {
        this.fecharModalPrompt()
        return
      }

      const wsId = Number.parseInt(ws, 10)
      const promptId = Number.parseInt(id, 10)
      if (!Number.isFinite(wsId) || !Number.isFinite(promptId)) return

      this.promptSalvando = true
      try {
        await $fetch('/api/admin/prompt/excluir', {
          method: 'POST',
          body: { workspace_id: wsId, id: promptId },
        })
        await this.recarregarPrompts(ws)
        this.fecharModalPrompt()
      } finally {
        this.promptSalvando = false
      }
    },

    async atualizarLimiteProdutos(
      limiteProdutos: number | null,
    ): Promise<AdminAtualizarLimiteProdutosResponse> {
      const ws = this.selectedWorkspaceId
      if (!ws) {
        throw new Error('Selecione um workspace na barra lateral.')
      }

      const wsId = Number.parseInt(ws, 10)
      if (!Number.isFinite(wsId) || wsId < 1) {
        throw new Error('Workspace inválido.')
      }

      this.limiteProdutosSalvando = true
      try {
        const data = await $fetch<AdminAtualizarLimiteProdutosResponse>(
          '/api/admin/produtos/limite-produtos',
          {
            method: 'PATCH',
            body: {
              workspace_id: wsId,
              limite_produtos: limiteProdutos,
            },
          },
        )

        const idx = this.workspaces.findIndex((w) => w.id === data.id)
        if (idx >= 0) {
          this.workspaces[idx] = {
            ...this.workspaces[idx],
            limite_produtos: data.limite_produtos,
          }
        }

        return data
      } finally {
        this.limiteProdutosSalvando = false
      }
    },
  },
})
