<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'
import NotificacaoPedidoPronto from './NotificacaoPedidoPronto.vue'
import { imprimirCupomPedido } from './imprimirCupomPedido'
import {
  formatMoedaBr,
  isPedidoPronto,
  labelTipoSolicitacao,
  parseProdutosNotificacao,
} from './parseProdutosNotificacao'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  conversaKey: string
  title?: string
}>()

const kanban = useKanbanStore()
const workspaces = useWorkspacesStore()
const { columns } = storeToRefs(kanban)

const expandidoId = ref<number | null>(null)
const modalExcluirAberto = ref(false)
const notificacaoParaExcluir = ref<KanbanNotificacaoIa | null>(null)

/** IDs com request em andamento (não bloqueia outras notificações). */
const emVoo = reactive<Record<number, true>>({})
/** Mensagem de erro por id (borda vermelha + texto). */
const errosPorId = reactive<Record<number, string>>({})

const workspaceId = computed(() => {
  const n = Number.parseInt(String(workspaces.currentWorkspaceId ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const lojaNome = computed(() => {
  const id = workspaces.currentWorkspaceId
  if (!id) return null
  const ws = workspaces.items.find((w) => String(w.id) === String(id))
  return ws?.nome?.trim() || null
})

watch(open, (aberto) => {
  if (!aberto) {
    expandidoId.value = null
    modalExcluirAberto.value = false
    notificacaoParaExcluir.value = null
  }
})

const cardNoPinia = computed(() => {
  const key = props.conversaKey?.trim()
  if (!key) return null
  for (const col of columns.value) {
    const card = col.cards.find((c) => c.conversa_key === key)
    if (card) return card
  }
  return null
})

const notificacoes = computed<KanbanNotificacaoIa[]>(() => {
  const list = cardNoPinia.value?.notificacoes_ia
  if (!Array.isArray(list)) return []
  return [...list]
    .filter((n) => n.concluido === false && isPedidoPronto(n.tipo_solicitacao))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
})

watch(
  notificacoes,
  (lista) => {
    if (expandidoId.value == null) return
    if (!lista.some((n) => n.id === expandidoId.value)) {
      expandidoId.value = null
    }
  },
  { flush: 'post' },
)

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function textoOuTraco(v: string | null | undefined): string {
  const t = typeof v === 'string' ? v.trim() : ''
  return t || '—'
}

function qtdItensPedido(item: KanbanNotificacaoIa): number {
  return parseProdutosNotificacao(item.produtos).length
}

function toggleExpandido(id: number) {
  expandidoId.value = expandidoId.value === id ? null : id
}

function clonarNotificacao(item: KanbanNotificacaoIa): KanbanNotificacaoIa {
  return {
    ...item,
    produtos: Array.isArray(item.produtos) ? [...item.produtos] : [],
  }
}

function estaEmVoo(id: number): boolean {
  return emVoo[id] === true
}

function marcarEmVoo(id: number) {
  emVoo[id] = true
}

function limparEmVoo(id: number) {
  delete emVoo[id]
}

function marcarErro(id: number, mensagem: string) {
  errosPorId[id] = mensagem
}

function limparErro(id: number) {
  delete errosPorId[id]
}

function temErro(id: number): boolean {
  return typeof errosPorId[id] === 'string' && errosPorId[id]!.length > 0
}

function mensagemErro(id: number): string {
  return errosPorId[id] ?? ''
}

function aceitarPedido(item: KanbanNotificacaoIa, payload: { imprimir: boolean }) {
  const key = props.conversaKey?.trim()
  const wsId = workspaceId.value
  if (!key || !wsId || estaEmVoo(item.id)) return
  if (item.concluido === true) return

  const snapshot = clonarNotificacao(item)
  const card = cardNoPinia.value
  limparErro(item.id)
  marcarEmVoo(item.id)

  // Otimista: some da lista na hora.
  kanban.setNotificacaoIaConcluido(key, item.id, true)

  // Move para coluna ordem 4 (Em Separação).
  void kanban.moverConversaParaColunaOrdem({
    workspaceId: wsId,
    conversaKey: key,
    ordem: 4,
  })

  if (payload.imprimir) {
    imprimirCupomPedido({
      item: snapshot,
      lojaNome: lojaNome.value,
      clienteNome: card?.name ?? card?.name_group ?? null,
      clienteTelefone: card?.phone ?? null,
      canalNome: card?.canal_nome ?? null,
    })
  }

  void (async () => {
    try {
      await kanban.patchNotificacaoIaConcluido({
        workspaceId: wsId,
        conversaKey: key,
        notificacaoId: item.id,
        concluido: true,
      })
      toast.success('Pedido em preparação', {
        description: 'O pedido foi aceito e está em preparação.',
      })
    } catch (err) {
      const msg = mensagemErroFetch(err, 'Não foi possível aceitar o pedido.')
      kanban.restaurarNotificacaoIaNoCard(key, { ...snapshot, concluido: false })
      marcarErro(item.id, msg)
      toast.error(msg)
    } finally {
      limparEmVoo(item.id)
    }
  })()
}

function rejeitarPedido(item: KanbanNotificacaoIa) {
  if (estaEmVoo(item.id)) return
  notificacaoParaExcluir.value = item
  modalExcluirAberto.value = true
}

function confirmarExcluirNotificacao() {
  const item = notificacaoParaExcluir.value
  const key = props.conversaKey?.trim()
  const wsId = workspaceId.value

  modalExcluirAberto.value = false
  notificacaoParaExcluir.value = null

  if (!item || !key || !wsId || estaEmVoo(item.id)) return

  const snapshot = clonarNotificacao(item)
  limparErro(item.id)
  marcarEmVoo(item.id)

  if (expandidoId.value === item.id) expandidoId.value = null

  // Otimista: some da lista na hora.
  kanban.removerNotificacaoIaDoCard(key, item.id)

  void (async () => {
    try {
      await kanban.deleteNotificacaoIa({
        workspaceId: wsId,
        conversaKey: key,
        notificacaoId: item.id,
      })
    } catch (err) {
      const msg = mensagemErroFetch(err, 'Não foi possível excluir a notificação.')
      kanban.restaurarNotificacaoIaNoCard(key, snapshot)
      marcarErro(item.id, msg)
      toast.error(msg)
    } finally {
      limparEmVoo(item.id)
    }
  })()
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="title ?? 'Pedidos'"
    panel-class="w-full max-w-lg"
    body-class="max-h-[min(75vh,36rem)] overflow-y-auto !p-4 sm:!p-5"
  >
    <p
      v-if="notificacoes.length === 0"
      class="py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido pendente nesta conversa.
    </p>

    <ul v-else class="space-y-3" role="list">
      <li
        v-for="item in notificacoes"
        :key="item.id"
        class="overflow-hidden rounded-2xl border bg-surface-container-lowest shadow-sm dark:bg-dark-surface-container-low"
        :class="temErro(item.id)
          ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-400 dark:ring-red-400/30'
          : 'border-outline/35 dark:border-dark-outline/35'"
      >
        <p
          v-if="temErro(item.id)"
          class="border-b border-red-500/30 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300"
        >
          {{ mensagemErro(item.id) }}
        </p>

        <!-- Resumo (sempre visível) -->
        <div
          class="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-container-high/50 dark:hover:bg-dark-surface-container-high/35"
          role="button"
          tabindex="0"
          :aria-expanded="expandidoId === item.id"
          @click="toggleExpandido(item.id)"
          @keydown.enter.prevent="toggleExpandido(item.id)"
          @keydown.space.prevent="toggleExpandido(item.id)"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
                Nº {{ item.id }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                :class="isPedidoPronto(item.tipo_solicitacao)
                  ? 'bg-primary-500/10 text-primary-700 dark:bg-primary-400/15 dark:text-primary-300'
                  : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="temErro(item.id) ? 'bg-red-500' : item.concluido ? 'bg-emerald-500' : 'bg-amber-500'"
                  aria-hidden="true"
                />
                {{ labelTipoSolicitacao(item.tipo_solicitacao) }}
              </span>
            </div>

            <p class="text-xs tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ formatData(item.created_at) }}
            </p>

            <template v-if="isPedidoPronto(item.tipo_solicitacao)">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
                  {{ formatMoedaBr(item.total_orcamento) }}
                </span>
                <span class="text-on-surface-variant dark:text-dark-on-surface-variant">
                  {{ textoOuTraco(item.forma_pagamento) }}
                </span>
                <span
                  v-if="qtdItensPedido(item) > 0"
                  class="text-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  {{ qtdItensPedido(item) }}
                  {{ qtdItensPedido(item) === 1 ? 'item' : 'itens' }}
                </span>
              </div>
            </template>
            <template v-else>
              <p class="line-clamp-2 text-sm text-on-surface dark:text-dark-on-surface">
                {{ textoOuTraco(item.observacoes) }}
              </p>
            </template>
          </div>

          <span
            class="material-symbols-outlined shrink-0 text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
            aria-hidden="true"
          >
            {{ expandidoId === item.id ? 'expand_less' : 'expand_more' }}
          </span>
        </div>

        <!-- Detalhe expandido -->
        <div
          v-if="expandidoId === item.id"
          class="border-t border-outline/25 px-4 py-4 dark:border-dark-outline/25"
        >
          <NotificacaoPedidoPronto
            v-if="isPedidoPronto(item.tipo_solicitacao)"
            :item="item"
            :busy="estaEmVoo(item.id)"
            @aceitar="aceitarPedido(item, $event)"
            @rejeitar="rejeitarPedido(item)"
          />

          <div v-else class="space-y-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
                Observações
              </p>
              <p class="mt-0.5 whitespace-pre-wrap text-sm text-on-surface dark:text-dark-on-surface">
                {{ textoOuTraco(item.observacoes) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
                Atualizado em
              </p>
              <p class="mt-0.5 text-sm tabular-nums text-on-surface dark:text-dark-on-surface">
                {{ formatData(item.updated_at) }}
              </p>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </BaseModal>

  <ModalAlerta
    v-model:open="modalExcluirAberto"
    title="Excluir notificação?"
    :texto="notificacaoParaExcluir
      ? `A notificação Nº ${notificacaoParaExcluir.id} será apagada permanentemente. Esta ação não pode ser desfeita.`
      : 'A notificação será apagada permanentemente.'"
    variante="perigo"
    texto-confirmar="Excluir"
    texto-cancelar="Cancelar"
    @confirmar="confirmarExcluirNotificacao"
  />
</template>
