import { defineStore } from 'pinia'
import type {
  AtualizarMensagemProntaResponse,
  CriarMensagemProntaResponse,
  ExcluirMensagemProntaResponse,
  ListarMensagensProntasResponse,
  MensagemProntaComPassos,
  MensagemProntaListaItem,
  MensagemProntaPasso,
  MensagemProntaPassoInput,
  WebhookN8nMensagemProntaBody,
  WebhookN8nMensagemProntaResponse,
} from '#shared/types/mensagensProntas'
import { mensagemErroFetch } from '~/stores/canais'
import { resolverMensagemProntaParaEnvio } from '#shared/utils/mensagemProntaVariaveis'

type State = {
  /** `undefined` = ainda não carregou; `[]` = carregou e está vazio. */
  porWorkspace: Record<number, MensagemProntaComPassos[] | undefined>
  pendingByWorkspace: Record<number, boolean>
  error: string | null
  workspaceId: number | null
}

const inflight = new Map<number, Promise<void>>()

function mapColunaDestinoId(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function mapIaLigada(raw: unknown): boolean {
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  return true
}

function mapFecharPedidoEmAberto(raw: unknown): boolean {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return false
}

function normalizeItem(item: MensagemProntaComPassos): MensagemProntaComPassos {
  return {
    sequencia: {
      ...item.sequencia,
      coluna_destino_id: mapColunaDestinoId(item.sequencia.coluna_destino_id),
      ia_ligada: mapIaLigada(item.sequencia.ia_ligada),
      fechar_pedido_em_aberto: mapFecharPedidoEmAberto(item.sequencia.fechar_pedido_em_aberto),
    },
    passos: item.passos ?? [],
  }
}

function previewTexto(passos: MensagemProntaPasso[], fallbackNome: string): string {
  const passoTexto = passos.find((p) => p.tipo === 'texto')
  if (passoTexto?.conteudo?.trim()) return passoTexto.conteudo.trim()

  const primeiro = passos[0]
  if (!primeiro) return fallbackNome
  if (primeiro.tipo === 'texto') return primeiro.conteudo.trim() || fallbackNome

  const labelTipo: Record<string, string> = {
    imagem: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    documento: 'Documento',
    figurinha: 'Figurinha',
  }
  return labelTipo[primeiro.tipo] ?? fallbackNome
}

export function mensagemProntaParaListaItem(item: MensagemProntaComPassos): MensagemProntaListaItem {
  return {
    id: item.sequencia.id,
    titulo: item.sequencia.nome,
    texto: previewTexto(item.passos, item.sequencia.nome),
  }
}

export const useMensagensProntasStore = defineStore('mensagensProntas', {
  state: (): State => ({
    porWorkspace: {},
    pendingByWorkspace: {},
    error: null,
    workspaceId: null,
  }),

  getters: {
    items(state): MensagemProntaComPassos[] {
      if (state.workspaceId == null) return []
      return state.porWorkspace[state.workspaceId] ?? []
    },

    listaDropdown(): MensagemProntaListaItem[] {
      return this.items.map(mensagemProntaParaListaItem)
    },

    pending(state): boolean {
      if (state.workspaceId == null) return false
      return Boolean(state.pendingByWorkspace[state.workspaceId])
    },

    temCarregado:
      (state) =>
      (workspaceId: number): boolean =>
        state.porWorkspace[workspaceId] !== undefined,
  },

  actions: {
    reset() {
      this.porWorkspace = {}
      this.pendingByWorkspace = {}
      this.error = null
      this.workspaceId = null
      inflight.clear()
    },

    /**
     * Cache-first: se já houver lista para o workspace, não chama a API.
     * Gatilho típico: abrir o dropdown de mensagens prontas.
     */
    async ensureLista(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return

      this.workspaceId = workspaceId

      if (this.porWorkspace[workspaceId] !== undefined) return

      const existing = inflight.get(workspaceId)
      if (existing) {
        await existing
        return
      }

      const run = (async () => {
        this.pendingByWorkspace[workspaceId] = true
        this.error = null
        try {
          const res = await $fetch<ListarMensagensProntasResponse>('/api/mensagens_prontas', {
            query: { workspace_id: workspaceId },
          })
          this.porWorkspace[workspaceId] = (res.items ?? []).map(normalizeItem)
        } catch (err: unknown) {
          this.error = mensagemErroFetch(err, 'Não foi possível carregar as mensagens prontas.')
          throw err
        } finally {
          this.pendingByWorkspace[workspaceId] = false
          inflight.delete(workspaceId)
        }
      })()

      inflight.set(workspaceId, run)
      await run
    },

    /** Busca uma sequência específica (ex.: agendamento vinculado à coluna do kanban). */
    async fetchSequenciaPorId(
      workspaceId: number,
      sequenciaId: string | number,
    ): Promise<MensagemProntaComPassos | null> {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return null
      const id = String(sequenciaId).trim()
      if (!id) return null

      this.workspaceId = workspaceId

      try {
        const res = await $fetch<ListarMensagensProntasResponse>('/api/mensagens_prontas', {
          query: { workspace_id: workspaceId, sequencia_id: id },
        })
        const item = (res.items ?? []).map(normalizeItem)[0] ?? null
        if (item) {
          const atual = this.porWorkspace[workspaceId]
          if (atual === undefined) {
            this.porWorkspace[workspaceId] = [item]
          } else if (!atual.some((i) => i.sequencia.id === item.sequencia.id)) {
            this.porWorkspace[workspaceId] = [item, ...atual]
          } else {
            this.porWorkspace[workspaceId] = atual.map((i) =>
              i.sequencia.id === item.sequencia.id ? item : i,
            )
          }
        }
        return item
      } catch (err: unknown) {
        this.error = mensagemErroFetch(err, 'Não foi possível carregar a mensagem pronta.')
        throw err
      }
    },

    /** Força novo GET (ex.: pull-to-refresh futuro). */
    async refreshLista(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      delete this.porWorkspace[workspaceId]
      await this.ensureLista(workspaceId)
    },

    /** Insere no topo do cache após criar (sem novo GET). */
    adicionarDoCreate(workspaceId: number, res: CriarMensagemProntaResponse) {
      const entry = normalizeItem({
        sequencia: res.sequencia,
        passos: res.passos,
      })
      const atual = this.porWorkspace[workspaceId]
      if (atual === undefined) {
        this.porWorkspace[workspaceId] = [entry]
      } else {
        this.porWorkspace[workspaceId] = [
          entry,
          ...atual.filter((i) => i.sequencia.id !== entry.sequencia.id),
        ]
      }
      this.workspaceId = workspaceId
    },

    /** Substitui item no cache após PATCH. */
    substituirDoUpdate(workspaceId: number, res: AtualizarMensagemProntaResponse) {
      const entry = normalizeItem({
        sequencia: res.sequencia,
        passos: res.passos,
      })
      const atual = this.porWorkspace[workspaceId]
      if (atual === undefined) {
        this.porWorkspace[workspaceId] = [entry]
      } else {
        this.porWorkspace[workspaceId] = atual.map((i) =>
          i.sequencia.id === entry.sequencia.id ? entry : i,
        )
      }
      this.workspaceId = workspaceId
    },

    /** Remove do cache após DELETE. */
    removerDoCache(workspaceId: number, sequenciaId: string) {
      const id = sequenciaId.trim()
      const atual = this.porWorkspace[workspaceId]
      if (atual === undefined) return
      this.porWorkspace[workspaceId] = atual.filter((i) => i.sequencia.id !== id)
    },

    getById(sequenciaId: string): MensagemProntaComPassos | null {
      const id = sequenciaId.trim()
      if (!id) return null
      const found = this.items.find((i) => i.sequencia.id === id) ?? null
      return found ? normalizeItem(found) : null
    },

    async criarSequencia(input: {
      workspaceId: number
      nome: string
      passos: MensagemProntaPassoInput[]
      coluna_destino_id?: number | null
      ia_ligada?: boolean
      fechar_pedido_em_aberto?: boolean
    }) {
      const res = await $fetch<CriarMensagemProntaResponse>('/api/mensagens_prontas', {
        method: 'POST',
        body: {
          workspace_id: input.workspaceId,
          nome: input.nome,
          passos: input.passos,
          coluna_destino_id: input.coluna_destino_id ?? null,
          ia_ligada: input.ia_ligada ?? true,
          fechar_pedido_em_aberto: input.fechar_pedido_em_aberto ?? false,
        },
      })
      this.adicionarDoCreate(input.workspaceId, res)
      return res
    },

    async atualizarSequencia(input: {
      workspaceId: number
      sequenciaId: string
      nome: string
      passos: MensagemProntaPassoInput[]
      coluna_destino_id?: number | null
      ia_ligada?: boolean
      fechar_pedido_em_aberto?: boolean
    }) {
      const res = await $fetch<AtualizarMensagemProntaResponse>(
        `/api/mensagens_prontas/${encodeURIComponent(input.sequenciaId)}`,
        {
          method: 'PATCH',
          body: {
            workspace_id: input.workspaceId,
            nome: input.nome,
            passos: input.passos,
            coluna_destino_id: input.coluna_destino_id ?? null,
            ia_ligada: input.ia_ligada ?? true,
            fechar_pedido_em_aberto: input.fechar_pedido_em_aberto ?? false,
          },
        },
      )
      this.substituirDoUpdate(input.workspaceId, res)
      return res
    },

    async excluirSequencia(workspaceId: number, sequenciaId: string) {
      const res = await $fetch<ExcluirMensagemProntaResponse>(
        `/api/mensagens_prontas/${encodeURIComponent(sequenciaId)}`,
        {
          method: 'DELETE',
          query: { workspace_id: workspaceId },
        },
      )
      this.removerDoCache(workspaceId, sequenciaId)
      return res
    },

    /**
     * Garante a sequência no cache Pinia: usa o que já tem; se faltar, GET /api/mensagens_prontas.
     */
    async garantirSequenciaNoCache(
      workspaceId: number,
      sequenciaId: string | number,
    ): Promise<MensagemProntaComPassos | null> {
      const id = String(sequenciaId).trim()
      if (!id || !Number.isFinite(workspaceId) || workspaceId < 1) return null

      this.workspaceId = workspaceId
      const cached = this.getById(id)
      if (cached) return cached

      await this.ensureLista(workspaceId)
      const fromLista = this.getById(id)
      if (fromLista) return fromLista

      return await this.fetchSequenciaPorId(workspaceId, id)
    },

    /**
     * Dispara POST /api/mensagens_prontas/webhookN8nPost com a sequência completa.
     * Passos de texto já saem com `{primeiro-nome}` e `{saudacao}` resolvidos.
     */
    async dispararWebhookN8n(input: {
      workspaceId: number
      canalId: number
      conversaKey: string
      phone: string | null
      name: string | null
      sequenciaId: string
    }) {
      const raw = await this.garantirSequenciaNoCache(input.workspaceId, input.sequenciaId)
      if (!raw) {
        throw new Error('Mensagem pronta não encontrada.')
      }

      // Clone para não mutar o cache Pinia e garantir strings plain.
      const cloned = JSON.parse(JSON.stringify(raw)) as MensagemProntaComPassos
      const mensagem_pronta = resolverMensagemProntaParaEnvio(cloned, input.name)
      const coluna_destino_id = mensagem_pronta.sequencia.coluna_destino_id ?? null
      const ia_ligada = mensagem_pronta.sequencia.ia_ligada !== false
      const fechar_pedido_em_aberto = mensagem_pronta.sequencia.fechar_pedido_em_aberto === true

      const body: WebhookN8nMensagemProntaBody = {
        workspace_id: input.workspaceId,
        canal_id: input.canalId,
        conversa_key: input.conversaKey,
        phone: input.phone,
        name: input.name,
        mensagem_pronta,
        coluna_destino_id,
        mover_contato: coluna_destino_id != null,
        ia_ligada,
        fechar_pedido_em_aberto,
      }

      return await $fetch<WebhookN8nMensagemProntaResponse>(
        '/api/mensagens_prontas/webhookN8nPost',
        {
          method: 'POST',
          body,
        },
      )
    },
  },
})
