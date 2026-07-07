import { defineStore } from 'pinia'
import type { WorkspaceConfiguracoes } from '#shared/types/configuracoes'
import { ehDestinoNotificacaoValido } from '#shared/utils/validarDestinoNotificacao'
import { mensagemErroFetch } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

type ConfigCache = Record<number, WorkspaceConfiguracoes | undefined>

const fetchesEmCurso = new Map<number, Promise<boolean>>()

const TELEFONE_REGEX = /^[0-9]{12,13}$/

const TEMPO_RESPOSTA_PADRAO = 10
const TEMPO_PAUSA_PADRAO = 28800

function parseWorkspaceIdAtual(): number | null {
  const workspaces = useWorkspacesStore()
  const raw = workspaces.currentWorkspaceId
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normalizarConfiguracoes(config: WorkspaceConfiguracoes): WorkspaceConfiguracoes {
  return {
    ...config,
    tempo_resposta:
      typeof config.tempo_resposta === 'number' && Number.isFinite(config.tempo_resposta)
        ? Math.trunc(config.tempo_resposta)
        : TEMPO_RESPOSTA_PADRAO,
    tempo_pausa:
      typeof config.tempo_pausa === 'number' && Number.isFinite(config.tempo_pausa)
        ? Math.trunc(config.tempo_pausa)
        : TEMPO_PAUSA_PADRAO,
  }
}

/** HTML vazio do editor → null para a API */
export function descricaoParaApi(html: string): string | null {
  const texto = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.length ? html.trim() : null
}

export const useConfiguracoesStore = defineStore('configuracoes', {
  state: () => ({
    porWorkspace: {} as ConfigCache,
    fetchPending: {} as Record<number, boolean>,
    fetchError: null as string | null,
    salvando: false,
  }),

  getters: {
    carregando:
      (state) =>
      (workspaceId: number): boolean =>
        Boolean(state.fetchPending[workspaceId]),
    doWorkspace:
      (state) =>
      (workspaceId: number): WorkspaceConfiguracoes | undefined =>
        state.porWorkspace[workspaceId],
  },

  actions: {
    /**
     * Garante config carregada e devolve `coluna_origem_leads` como id numérico (> 0).
     * `null` se ausente, `"0"` ou inválido.
     */
    async obterColunaOrigemLeadsId(workspaceId: number): Promise<number | null> {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return null
      const ok = await this.fetchSeNecessario(workspaceId)
      if (!ok) return null
      const raw = this.porWorkspace[workspaceId]?.coluna_origem_leads
      if (raw == null || String(raw).trim() === '') return null
      const n = Number.parseInt(String(raw).trim(), 10)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
      return n
    },

    atualizarCampo<K extends keyof WorkspaceConfiguracoes>(
      workspaceId: number,
      campo: K,
      valor: WorkspaceConfiguracoes[K],
    ) {
      const atual = this.porWorkspace[workspaceId]
      if (!atual) return
      this.porWorkspace[workspaceId] = { ...atual, [campo]: valor }
    },

    async fetchSeNecessario(workspaceId: number): Promise<boolean> {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        return false
      }
      if (this.porWorkspace[workspaceId] !== undefined) {
        this.porWorkspace[workspaceId] = normalizarConfiguracoes(this.porWorkspace[workspaceId]!)
        return true
      }
      const emCurso = fetchesEmCurso.get(workspaceId)
      if (emCurso) {
        return emCurso
      }

      const promise = (async (): Promise<boolean> => {
        this.fetchPending[workspaceId] = true
        this.fetchError = null

        try {
          const res = await $fetch<WorkspaceConfiguracoes>('/api/configuracoes/ia', {
            method: 'GET',
            query: { workspace_id: workspaceId },
          })
          this.porWorkspace[workspaceId] = normalizarConfiguracoes(res)
          return true
        } catch (err) {
          this.fetchError = mensagemErroFetch(err, 'Não foi possível carregar as configurações.')
          return false
        } finally {
          this.fetchPending[workspaceId] = false
        }
      })()

      fetchesEmCurso.set(workspaceId, promise)
      try {
        return await promise
      } finally {
        fetchesEmCurso.delete(workspaceId)
      }
    },

    aplicarSalva(workspaceId: number, config: WorkspaceConfiguracoes) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      this.porWorkspace[workspaceId] = normalizarConfiguracoes(config)
    },

    validar(config: WorkspaceConfiguracoes): string | null {
      if (!config.nome.trim()) {
        return 'Informe o nome do workspace.'
      }
      if (config.fase_teste) {
        const numero = config.numero_testes?.trim() ?? ''
        if (!TELEFONE_REGEX.test(numero)) {
          return 'Informe um número válido para a fase de teste.'
        }
      }
      const notificacao = config.numero_notificacao?.trim() ?? ''
      if (notificacao && !ehDestinoNotificacaoValido(notificacao)) {
        return 'Informe um telefone ou grupo WhatsApp válido para notificações.'
      }
      return null
    },

    async salvar(workspaceIdParam?: number): Promise<WorkspaceConfiguracoes | null> {
      const workspaceId = workspaceIdParam ?? parseWorkspaceIdAtual()
      if (workspaceId == null || !Number.isFinite(workspaceId) || workspaceId < 1) {
        throw new Error('Workspace não encontrado.')
      }

      const bruto = this.porWorkspace[workspaceId]
      if (!bruto) {
        throw new Error('Configurações não carregadas.')
      }

      const config = normalizarConfiguracoes(bruto)
      this.porWorkspace[workspaceId] = config

      const erro = this.validar(config)
      if (erro) {
        throw new Error(erro)
      }

      this.salvando = true
      try {
        const salvo = await $fetch<WorkspaceConfiguracoes>('/api/configuracoes/ia', {
          method: 'PATCH',
          body: {
            workspace_id: workspaceId,
            nome: config.nome.trim(),
            descricao: descricaoParaApi(config.descricao ?? ''),
            fase_teste: config.fase_teste,
            numero_testes: config.fase_teste ? config.numero_testes?.trim() ?? null : null,
            numero_notificacao: config.numero_notificacao?.trim() || null,
            tempo_resposta: config.tempo_resposta,
            tempo_pausa: config.tempo_pausa,
            coluna_origem_leads: (() => {
              const raw = config.coluna_origem_leads?.trim() || ''
              if (!raw) return null
              const n = Number.parseInt(raw, 10)
              return Number.isFinite(n) && n >= 1 ? n : null
            })(),
          },
        })
        this.aplicarSalva(workspaceId, normalizarConfiguracoes(salvo))

        const workspaces = useWorkspacesStore()
        const idx = workspaces.items.findIndex((w) => w.id === workspaceId)
        if (idx !== -1) {
          workspaces.items[idx] = {
            ...workspaces.items[idx],
            nome: salvo.nome,
            descricao: salvo.descricao,
          }
        }

        return salvo
      } catch (err) {
        throw new Error(mensagemErroFetch(err, 'Falha ao salvar configurações.'))
      } finally {
        this.salvando = false
      }
    },

    invalidar(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      fetchesEmCurso.delete(workspaceId)
      const next = { ...this.porWorkspace } as ConfigCache
      delete next[workspaceId]
      this.porWorkspace = next
    },

    limparErro() {
      this.fetchError = null
    },
  },
})
