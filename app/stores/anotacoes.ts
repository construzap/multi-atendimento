import { defineStore } from 'pinia'
import type {
  Anotacao,
  AnotacaoCriarBody,
  AnotacaoMidiaUploadResponse,
  AnotacaoTipo,
} from '#shared/types/anotacao'
import { useConversasStore } from '~/stores/conversas'

function inferirTipoPorMime(mime: string): Exclude<AnotacaoTipo, 'texto'> {
  const m = (mime.split(';')[0] ?? '').trim().toLowerCase()
  if (m.startsWith('image/')) return 'imagem'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  return 'documento'
}

type State = {
  /** Pending do ensure (1ª página) por conversa_key. */
  pendingByKey: Record<string, boolean>
  /** Pending do “carregar mais” por conversa_key. */
  pendingMoreByKey: Record<string, boolean>
}

export const useAnotacoesStore = defineStore('anotacoes', {
  state: (): State => ({
    pendingByKey: {},
    pendingMoreByKey: {},
  }),
  getters: {
    pendingDaConversa:
      (state) =>
      (conversaKey: string): boolean => {
        const k = conversaKey.trim()
        return Boolean(state.pendingByKey[k])
      },
    pendingMoreDaConversa:
      (state) =>
      (conversaKey: string): boolean => {
        const k = conversaKey.trim()
        return Boolean(state.pendingMoreByKey[k])
      },
  },
  actions: {
    /**
     * Cache-first via `conversas.byCanal.items[].anotacoes`.
     * Só chama GET se `anotacoes` ainda for `undefined`.
     */
    async fetchDaConversa(workspaceId: number, conversaKey: string) {
      const key = conversaKey.trim()
      if (!key || workspaceId < 1) return

      const conversas = useConversasStore()
      const existente = conversas.findConversaByKey(key)
      if (existente?.anotacoes !== undefined) return

      this.pendingByKey[key] = true
      try {
        await conversas.ensureAnotacoesNaConversa(workspaceId, key)
      } finally {
        this.pendingByKey[key] = false
      }
    },

    async carregarMais(workspaceId: number, conversaKey: string) {
      const key = conversaKey.trim()
      if (!key || workspaceId < 1) return

      if (this.pendingMoreByKey[key] || this.pendingByKey[key]) return

      this.pendingMoreByKey[key] = true
      try {
        await useConversasStore().carregarMaisAnotacoesNaConversa(workspaceId, key)
      } finally {
        this.pendingMoreByKey[key] = false
      }
    },

    async uploadMidia(input: {
      workspaceId: number
      file: File
      tipo?: Exclude<AnotacaoTipo, 'texto'>
    }): Promise<AnotacaoMidiaUploadResponse> {
      const mime = (input.file.type || 'application/octet-stream').split(';')[0]!.trim().toLowerCase()
      const tipo = input.tipo ?? inferirTipoPorMime(mime)

      const data_base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result ?? '')
          const b64 = result.includes('base64,') ? result.split('base64,')[1] ?? '' : result
          if (!b64) reject(new Error('Falha ao ler o arquivo.'))
          else resolve(b64)
        }
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
        reader.readAsDataURL(input.file)
      })

      return await $fetch<AnotacaoMidiaUploadResponse>('/api/anotacoes_conversas/upload-midia', {
        method: 'POST',
        body: {
          workspace_id: input.workspaceId,
          tipo_anotacao: tipo,
          mime,
          data_base64,
          filename: input.file.name,
        },
      })
    },

    /**
     * Fluxo: só texto → POST; com mídia → B2 depois POST com `media_url`.
     * Grava no Pinia em `conversas.byCanal.items[].anotacoes` (mais recente no topo).
     */
    async criar(input: {
      workspaceId: number
      canalId: number
      conversaKey: string
      texto: string
      arquivo?: File | null
    }): Promise<Anotacao> {
      const texto = input.texto.trim()
      const arquivo = input.arquivo ?? null

      if (!arquivo && !texto) {
        throw new Error('Escreva um texto ou anexe uma mídia.')
      }

      let tipo_anotacao: AnotacaoTipo = 'texto'
      let media_url: string | null = null

      if (arquivo) {
        const up = await this.uploadMidia({
          workspaceId: input.workspaceId,
          file: arquivo,
        })
        media_url = up.url
        tipo_anotacao = up.tipo_anotacao
      }

      const body: AnotacaoCriarBody = {
        workspace_id: input.workspaceId,
        canal_id: input.canalId,
        conversa_key: input.conversaKey.trim(),
        tipo_anotacao,
        anotacao_text: texto,
        media_url,
      }

      const res = await $fetch<{ data: Anotacao }>('/api/anotacoes_conversas', {
        method: 'POST',
        body,
      })

      useConversasStore().prependAnotacaoNaConversa(res.data)
      return res.data
    },

    async excluir(input: {
      workspaceId: number
      conversaKey: string
      anotacaoId: number
    }): Promise<void> {
      const key = input.conversaKey.trim()
      const id = input.anotacaoId
      if (!key || input.workspaceId < 1 || id < 1) {
        throw new Error('Dados inválidos para excluir a anotação.')
      }

      await $fetch(`/api/anotacoes_conversas/${id}`, {
        method: 'DELETE',
        query: { workspace_id: input.workspaceId },
      })

      useConversasStore().removeAnotacaoDaConversa(key, id)
    },
  },
})
