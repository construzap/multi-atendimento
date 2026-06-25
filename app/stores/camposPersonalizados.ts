import { defineStore } from 'pinia'
import type {
  CampoPersonalizado,
  CampoPersonalizadoAtualizarResponse,
  CampoPersonalizadoCriarResponse,
  CamposPersonalizadosListaResponse,
  TipoCampoPersonalizado,
  ValorCampoPersonalizado,
  ValorCampoPersonalizadoSalvarResponse,
  ValoresCamposPersonalizadosListaResponse,
} from '#shared/types/camposPersonalizados'
import { mensagemErroFetch } from '~/stores/canais'

const MAX_VALORES_CONVERSAS_CACHE = 10

type CamposCache = Record<number, CampoPersonalizado[] | undefined>

/** Uma conversa em cache com os valores dos seus campos personalizados. */
export type ValoresConversaCache = {
  workspaceId: number
  conversaKey: string
  valores: ValorCampoPersonalizado[]
}

function valoresCacheKey(workspaceId: number, conversaKey: string): string {
  return `${workspaceId}:${conversaKey}`
}

function clonarValores(valores: ValorCampoPersonalizado[]): ValorCampoPersonalizado[] {
  return valores.map((v) => ({ ...v }))
}

type CamposPersonalizadosState = {
  workspaceId: number | null
  camposPorWorkspace: CamposCache
  /** Últimas conversas abertas (máx. 10). A mais recente fica por último. */
  valoresRecentes: ValoresConversaCache[]
  camposPending: boolean
  valoresPending: Record<string, boolean>
  error: string | null
}

export const useCamposPersonalizadosStore = defineStore('camposPersonalizados', {
  state: (): CamposPersonalizadosState => ({
    workspaceId: null,
    camposPorWorkspace: {},
    valoresRecentes: [],
    camposPending: false,
    valoresPending: {},
    error: null,
  }),

  getters: {
    campos(state): CampoPersonalizado[] {
      if (state.workspaceId == null) return []
      return state.camposPorWorkspace[state.workspaceId] ?? []
    },

    getValores:
      (state) =>
      (workspaceId: number, conversaKey: string): ValorCampoPersonalizado[] => {
        const entry = state.valoresRecentes.find(
          (e) => e.workspaceId === workspaceId && e.conversaKey === conversaKey,
        )
        return entry?.valores ?? []
      },

    getValorPorCampo() {
      return (workspaceId: number, conversaKey: string, campoId: number): string | null => {
        const lista = this.getValores(workspaceId, conversaKey)
        const item = lista.find((v) => v.campo_id === campoId)
        return item?.valor ?? null
      }
    },

    temValoresCarregados:
      (state) =>
      (workspaceId: number, conversaKey: string): boolean =>
        state.valoresRecentes.some(
          (e) => e.workspaceId === workspaceId && e.conversaKey === conversaKey,
        ),
  },

  actions: {
    reset() {
      this.workspaceId = null
      this.camposPorWorkspace = {}
      this.valoresRecentes = []
      this.camposPending = false
      this.valoresPending = {}
      this.error = null
    },

    invalidarWorkspace(workspaceId: number) {
      delete this.camposPorWorkspace[workspaceId]
      this.valoresRecentes = this.valoresRecentes.filter((e) => e.workspaceId !== workspaceId)

      for (const key of Object.keys(this.valoresPending)) {
        if (key.startsWith(`${workspaceId}:`)) {
          delete this.valoresPending[key]
        }
      }
    },

    temCamposCarregados(workspaceId: number): boolean {
      return this.camposPorWorkspace[workspaceId] !== undefined
    },

    /**
     * Preenche `valoresRecentes` a partir dos cards do kanban (view com campos personalizados).
     */
    hidratarValoresDoKanban(
      workspaceId: number,
      cards: Array<{
        conversa_key: string
        campos_personalizados?: Array<{ id: number; valor: string | null }>
      }>,
    ) {
      if (!workspaceId || cards.length === 0) return

      for (const card of cards) {
        const conversaKey = card.conversa_key?.trim()
        if (!conversaKey) continue

        const valores: ValorCampoPersonalizado[] = (card.campos_personalizados ?? [])
          .filter((c) => Number.isFinite(c.id) && c.id > 0)
          .map((c) => ({
            id: 0,
            campo_id: c.id,
            conversa_key: conversaKey,
            valor: c.valor ?? null,
            updated_at: '',
          }))
          .sort((a, b) => a.campo_id - b.campo_id)

        this._setValoresCache(workspaceId, conversaKey, valores)
      }
    },

    _obterEntradaValores(workspaceId: number, conversaKey: string): ValoresConversaCache | null {
      return (
        this.valoresRecentes.find(
          (e) => e.workspaceId === workspaceId && e.conversaKey === conversaKey,
        ) ?? null
      )
    },

    /**
     * Grava os valores de uma conversa e move para o fim da lista (mais recente).
     * Se passar de 10 conversas, remove a mais antiga (primeira da lista).
     */
    _setValoresCache(
      workspaceId: number,
      conversaKey: string,
      valores: ValorCampoPersonalizado[],
    ) {
      const copia = clonarValores(valores)
      const semAtual = this.valoresRecentes.filter(
        (e) => !(e.workspaceId === workspaceId && e.conversaKey === conversaKey),
      )

      semAtual.push({ workspaceId, conversaKey, valores: copia })

      this.valoresRecentes =
        semAtual.length > MAX_VALORES_CONVERSAS_CACHE
          ? semAtual.slice(-MAX_VALORES_CONVERSAS_CACHE)
          : semAtual
    },

    _aplicarCampo(workspaceId: number, campo: CampoPersonalizado) {
      let lista = this.camposPorWorkspace[workspaceId]
      if (!lista) {
        this.camposPorWorkspace[workspaceId] = [{ ...campo }]
        return
      }
      lista = lista.map((x) => ({ ...x }))
      const i = lista.findIndex((x) => x.id === campo.id)
      if (i >= 0) lista[i] = { ...campo }
      else lista.push({ ...campo })
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
      this.camposPorWorkspace[workspaceId] = lista
    },

    _removerCampo(workspaceId: number, campoId: number) {
      const lista = this.camposPorWorkspace[workspaceId]
      if (!lista) return
      this.camposPorWorkspace[workspaceId] = lista.filter((x) => x.id !== campoId)
    },

    _aplicarValor(workspaceId: number, conversaKey: string, valor: ValorCampoPersonalizado) {
      const entry = this.valoresRecentes.find(
        (e) => e.workspaceId === workspaceId && e.conversaKey === conversaKey,
      )
      const atual = entry?.valores ?? []
      const lista = clonarValores(atual)
      const i = lista.findIndex((x) => x.campo_id === valor.campo_id)

      if (i >= 0) lista[i] = { ...valor }
      else lista.push({ ...valor })

      lista.sort((a, b) => a.campo_id - b.campo_id)
      this._setValoresCache(workspaceId, conversaKey, lista)
    },

    async fetchCampos(workspaceId: number, options: { force?: boolean } = {}) {
      this.workspaceId = workspaceId

      if (!options.force && this.camposPorWorkspace[workspaceId] !== undefined) {
        return this.camposPorWorkspace[workspaceId] ?? []
      }

      this.camposPending = true
      this.error = null

      try {
        const res = await $fetch<CamposPersonalizadosListaResponse>('/api/campos-personalizados', {
          query: { workspace_id: workspaceId },
        })
        this.camposPorWorkspace[workspaceId] = res.data ?? []
        return this.camposPorWorkspace[workspaceId] ?? []
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível carregar os campos personalizados.')
        throw err
      } finally {
        this.camposPending = false
      }
    },

    async criarCampo(
      workspaceId: number,
      payload: { nome: string; tipo?: TipoCampoPersonalizado },
    ): Promise<CampoPersonalizado> {
      this.workspaceId = workspaceId
      this.error = null

      try {
        const res = await $fetch<CampoPersonalizadoCriarResponse>('/api/campos-personalizados', {
          method: 'POST',
          body: {
            workspace_id: workspaceId,
            nome: payload.nome,
            tipo: payload.tipo ?? 'text',
          },
        })
        this._aplicarCampo(workspaceId, res.data)
        return res.data
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível criar o campo personalizado.')
        throw err
      }
    },

    async atualizarCampo(
      workspaceId: number,
      campoId: number,
      payload: { nome?: string; tipo?: TipoCampoPersonalizado },
    ): Promise<CampoPersonalizado> {
      this.workspaceId = workspaceId
      this.error = null

      try {
        const res = await $fetch<CampoPersonalizadoAtualizarResponse>(
          `/api/campos-personalizados/${campoId}`,
          {
            method: 'PATCH',
            body: {
              workspace_id: workspaceId,
              ...payload,
            },
          },
        )
        this._aplicarCampo(workspaceId, res.data)
        return res.data
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível atualizar o campo personalizado.')
        throw err
      }
    },

    async excluirCampo(workspaceId: number, campoId: number): Promise<void> {
      this.workspaceId = workspaceId
      this.error = null

      try {
        await $fetch(`/api/campos-personalizados/${campoId}`, {
          method: 'DELETE',
          query: { workspace_id: workspaceId },
        })
        this._removerCampo(workspaceId, campoId)

        this.valoresRecentes = this.valoresRecentes.map((entry) => {
          if (entry.workspaceId !== workspaceId) return entry
          return {
            ...entry,
            valores: entry.valores.filter((v) => v.campo_id !== campoId),
          }
        })
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível excluir o campo personalizado.')
        throw err
      }
    },

    /**
     * Carrega os valores de uma conversa.
     *
     * 1. Se já estiver em `valoresRecentes` → retorna do cache (sem GET).
     * 2. Se não estiver → chama GET `/api/valores-campos-personalizados` e grava no cache.
     *
     * Use `{ force: true }` para ignorar o cache e buscar de novo na API.
     */
    async fetchValores(
      workspaceId: number,
      conversaKey: string,
      options: { force?: boolean } = {},
    ): Promise<ValorCampoPersonalizado[]> {
      if (!options.force) {
        const entrada = this._obterEntradaValores(workspaceId, conversaKey)
        if (entrada) {
          this._setValoresCache(workspaceId, conversaKey, entrada.valores)
          return clonarValores(entrada.valores)
        }
      }

      const key = valoresCacheKey(workspaceId, conversaKey)
      this.valoresPending[key] = true
      this.error = null

      try {
        const res = await $fetch<ValoresCamposPersonalizadosListaResponse>(
          '/api/valores-campos-personalizados',
          {
            query: {
              workspace_id: workspaceId,
              conversa_key: conversaKey,
            },
          },
        )
        const valores = res.data ?? []
        this._setValoresCache(workspaceId, conversaKey, valores)
        return clonarValores(valores)
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível carregar os valores dos campos.')
        throw err
      } finally {
        this.valoresPending[key] = false
      }
    },

    async salvarValor(
      workspaceId: number,
      conversaKey: string,
      campoId: number,
      valor: unknown,
    ): Promise<ValorCampoPersonalizado> {
      this.workspaceId = workspaceId
      this.error = null

      try {
        const res = await $fetch<ValorCampoPersonalizadoSalvarResponse>(
          '/api/valores-campos-personalizados',
          {
            method: 'POST',
            body: {
              workspace_id: workspaceId,
              conversa_key: conversaKey,
              campo_id: campoId,
              valor,
            },
          },
        )

        this._aplicarValor(workspaceId, conversaKey, res.data)
        return res.data
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível salvar o valor do campo.')
        throw err
      }
    },
  },
})
