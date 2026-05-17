import { defineStore } from 'pinia'
import type { AgendamentoMensagemListItem, AgendamentoMensagemListResponse } from '#shared/types/agendamentoMensagens'
import type { AgendamentoDiaItem } from '~/components/agendamento-de-mensagem/types'

const PAGE_SIZE_FETCH = 200
const MAX_PAGES = 80

/** Chave `yyyy-mm` (mês 1–12). */
export function agendamentosMensagensMonthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

function listRowToDiaItem(row: AgendamentoMensagemListItem): AgendamentoDiaItem {
  return {
    id: row.id,
    data_agendada: row.data_agendada,
    iana_timezone: row.iana_timezone,
    id_canal: row.id_canal,
    usuario_empresa_id: null,
    mensagem_type: row.mensagem_type,
    mensagem_texto: row.mensagem_texto,
    nomecliente: row.nomecliente,
    telefone: row.telefone,
    status: row.status,
    midia_url: row.midia_url,
    recorrente: row.recorrente,
    intervalo_recorrencia: row.intervalo_recorrencia,
  }
}

const carregarInflight = new Map<string, Promise<void>>()

type AgendamentosMensagensState = {
  /** Itens agregados de todas as páginas daquele mês. */
  porMes: Record<string, AgendamentoDiaItem[]>
  loadingMes: Record<string, boolean>
  erroMes: Record<string, string | null>
  /** Agendamento em edição (modal); `null` quando fechado ou modo criar. */
  agendamentoSelecionado: AgendamentoDiaItem | null
}

export const useAgendamentosMensagensStore = defineStore('agendamentosMensagens', {
  state: (): AgendamentosMensagensState => ({
    porMes: {},
    loadingMes: {},
    erroMes: {},
    agendamentoSelecionado: null,
  }),

  getters: {
    itensDoMes:
      (state) =>
      (year: number, month1to12: number): AgendamentoDiaItem[] => {
        const key = agendamentosMensagensMonthKey(year, month1to12)
        return state.porMes[key] ?? []
      },
    estaCarregandoMes:
      (state) =>
      (year: number, month1to12: number): boolean => {
        const key = agendamentosMensagensMonthKey(year, month1to12)
        return Boolean(state.loadingMes[key])
      },
  },

  actions: {
    temMesCarregado(year: number, month1to12: number): boolean {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      return Object.prototype.hasOwnProperty.call(this.porMes, key)
    },

    invalidarMes(year: number, month1to12: number) {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      delete this.porMes[key]
      delete this.loadingMes[key]
      delete this.erroMes[key]
    },

    /** Cópia superficial — evita o modal mutar o objeto da lista em cache. */
    setAgendamentoSelecionado(item: AgendamentoDiaItem | null) {
      this.agendamentoSelecionado = item ? { ...item } : null
    },

    limparAgendamentoSelecionado() {
      this.agendamentoSelecionado = null
    },

    /**
     * Se o mês já estiver em cache, não chama a API.
     * Caso contrário, busca todas as páginas daquele mês e grava em `porMes`.
     */
    async carregarMesSeNecessario(workspaceId: number, year: number, month1to12: number): Promise<void> {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      if (this.temMesCarregado(year, month1to12)) return

      const existente = carregarInflight.get(key)
      if (existente) {
        await existente
        return
      }

      const exec = (async () => {
        this.loadingMes[key] = true
        this.erroMes[key] = null
        try {
          const acumulado: AgendamentoDiaItem[] = []
          let page = 1
          let total = 0

          while (page <= MAX_PAGES) {
            const res = await $fetch<AgendamentoMensagemListResponse>('/api/agendamento-de-mensagem', {
              query: {
                workspace_id: workspaceId,
                year,
                month: month1to12,
                page,
                page_size: PAGE_SIZE_FETCH,
              },
            })
            total = res.total
            for (const row of res.items) {
              acumulado.push(listRowToDiaItem(row))
            }
            if (acumulado.length >= total || res.items.length === 0) break
            page += 1
          }

          this.porMes[key] = acumulado
        } catch (e: unknown) {
          const msg =
            e && typeof e === 'object' && 'data' in e
              ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
              : ''
          const fallback = e instanceof Error ? e.message : 'Falha ao carregar agendamentos.'
          this.erroMes[key] = msg || fallback
          throw e
        } finally {
          this.loadingMes[key] = false
          carregarInflight.delete(key)
        }
      })()

      carregarInflight.set(key, exec)
      await exec
    },
  },
})
