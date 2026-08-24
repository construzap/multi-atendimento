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
import ItemPedidoPronto from './ItemPedidoPronto.vue'
import PedidoProntoExpandido from './PedidoProntoExpandido.vue'
import { imprimirCupomPedido } from './imprimirCupomPedido'
import {
  isPedidoPronto,
  normalizeTotalOrcamento,
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
/** Padrão: só pendentes (`concluido === false`). */
const mostrarTodos = ref(false)
const filtroPending = ref(false)

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
    mostrarTodos.value = false
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
    .filter((n) => {
      if (!isPedidoPronto(n.tipo_solicitacao)) return false
      if (mostrarTodos.value) return true
      return n.concluido === false
    })
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
})

async function onToggleMostrarTodos() {
  const wsId = workspaceId.value
  if (!wsId) return
  filtroPending.value = true
  try {
    await kanban.refetchCurrentBoard(wsId)
  } catch {
    // erro já tratado na store
  } finally {
    filtroPending.value = false
  }
}

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

function toggleExpandido(id: number) {
  expandidoId.value = expandidoId.value === id ? null : id
}

function clonarNotificacao(item: KanbanNotificacaoIa): KanbanNotificacaoIa {
  return {
    ...item,
    produtos: Array.isArray(item.produtos) ? [...item.produtos] : [],
    total_orcamento: normalizeTotalOrcamento(item.total_orcamento),
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

function mensagemErro(id: number): string {
  return errosPorId[id] ?? ''
}

async function aceitarPedido(item: KanbanNotificacaoIa, payload: { imprimir: boolean }) {
  const key = props.conversaKey?.trim()
  const wsId = workspaceId.value
  if (!key || !wsId || estaEmVoo(item.id)) return

  const snapshot = clonarNotificacao(item)
  const card = cardNoPinia.value
  limparErro(item.id)
  marcarEmVoo(item.id)

  try {
    const ok = await kanban.moverConversaParaColunaOrdem({
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

    if (ok) {
      toast.success('Pedido em preparação', {
        description: 'O pedido foi aceito e está em preparação.',
      })
    }
  } catch (err) {
    const msg = mensagemErroFetch(err, 'Não foi possível aceitar o pedido.')
    marcarErro(item.id, msg)
    toast.error(msg)
  } finally {
    limparEmVoo(item.id)
  }
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
    <div class="mb-4 flex items-center justify-between gap-3">
      <label class="inline-flex cursor-pointer items-center gap-2 select-none">
        <span class="relative inline-flex items-center">
          <input
            v-model="mostrarTodos"
            type="checkbox"
            class="peer sr-only"
            role="switch"
            :disabled="filtroPending"
            aria-label="Mostrar todos os pedidos"
            @change="onToggleMostrarTodos"
          />
          <span
            class="relative h-5 w-9 rounded-full bg-outline/40 transition-colors peer-checked:bg-primary-500 peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300 dark:bg-dark-outline/50 dark:peer-checked:bg-primary-500"
            aria-hidden="true"
          >
            <span
              class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              :class="mostrarTodos ? 'translate-x-4' : 'translate-x-0'"
            />
          </span>
        </span>
        <span class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Mostrar todos
        </span>
      </label>
      <span
        v-if="filtroPending"
        class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Atualizando…
      </span>
    </div>

    <p
      v-if="notificacoes.length === 0"
      class="py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ mostrarTodos ? 'Nenhum pedido nesta conversa.' : 'Nenhum pedido pendente nesta conversa.' }}
    </p>

    <ul v-else class="space-y-3" role="list">
      <li v-for="item in notificacoes" :key="item.id">
        <ItemPedidoPronto
          :item="item"
          :expandido="expandidoId === item.id"
          :erro="mensagemErro(item.id) || null"
          @toggle="toggleExpandido(item.id)"
        >
          <PedidoProntoExpandido
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
        </ItemPedidoPronto>
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
