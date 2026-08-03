<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import type { ProdutoWorkspaceItem, ProdutosBuscaResponse } from '#shared/types/produtos'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'
import { formatMoedaBr } from './parseProdutosNotificacao'
import { imprimirCupomPedido } from './imprimirCupomPedido'

export type LinhaPedidoCriar = {
  key: string
  produtoId: number | null
  nome: string
  qtd: number
  preco: number
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  conversaKey: string
  canalId: number | null
  clienteNome?: string | null
  clienteTelefone?: string | null
  canalNome?: string | null
}>()

const emit = defineEmits<{
  criado: [notificacao: KanbanNotificacaoIa]
}>()

const kanban = useKanbanStore()
const workspaces = useWorkspacesStore()

const STORAGE_IMPRIMIR = 'kanban.notificacoes_ia.imprimir_ao_criar'

const linhas = ref<LinhaPedidoCriar[]>([])
const formaPagamento = ref('')
const imprimirAoCriar = ref(false)
const criando = ref(false)

const buscaTexto = ref('')
const buscaItens = ref<ProdutoWorkspaceItem[]>([])
const buscando = ref(false)
const painelBuscaAberto = ref(false)
let buscaTimer: ReturnType<typeof setTimeout> | null = null

const FORMAS_SUGESTAO = [
  'Pagamento a vista',
  'PIX',
  'Dinheiro',
  'Cartão de crédito',
  'Cartão de débito',
]

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

const totalOrcamento = computed(() =>
  linhas.value.reduce((acc, l) => acc + Math.max(0, l.qtd) * Math.max(0, l.preco), 0),
)

const podeCriar = computed(() => {
  if (criando.value) return false
  if (!workspaceId.value) return false
  if (!props.canalId || props.canalId < 1) return false
  if (!props.conversaKey?.trim()) return false
  if (!formaPagamento.value.trim()) return false
  if (linhas.value.length === 0) return false
  return linhas.value.every((l) => l.nome.trim() && l.qtd >= 1 && l.preco >= 0)
})

function lerPreferenciaImprimir(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(STORAGE_IMPRIMIR) === '1'
  } catch {
    return false
  }
}

function resetForm() {
  linhas.value = []
  formaPagamento.value = ''
  buscaTexto.value = ''
  buscaItens.value = []
  painelBuscaAberto.value = false
  imprimirAoCriar.value = lerPreferenciaImprimir()
  criando.value = false
}

watch(open, (aberto) => {
  if (aberto) resetForm()
})

function onChangeImprimir(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  imprimirAoCriar.value = checked
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_IMPRIMIR, checked ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function precoProduto(p: ProdutoWorkspaceItem): number {
  const promo = p.preco_promocional
  if (promo != null && Number.isFinite(Number(promo)) && Number(promo) > 0) {
    return Number(promo)
  }
  return Number.isFinite(Number(p.preco)) ? Number(p.preco) : 0
}

function adicionarProduto(p: ProdutoWorkspaceItem) {
  const existente = linhas.value.find((l) => l.produtoId === p.id)
  if (existente) {
    existente.qtd += 1
  } else {
    linhas.value.push({
      key: uid(),
      produtoId: p.id,
      nome: p.nome?.trim() || `Produto #${p.id}`,
      qtd: 1,
      preco: precoProduto(p),
    })
  }
  buscaTexto.value = ''
  buscaItens.value = []
  painelBuscaAberto.value = false
}

function removerLinha(key: string) {
  linhas.value = linhas.value.filter((l) => l.key !== key)
}

function setQtd(key: string, raw: string) {
  const linha = linhas.value.find((l) => l.key === key)
  if (!linha) return
  const n = Number.parseInt(raw.replace(/\D/g, ''), 10)
  linha.qtd = Number.isFinite(n) && n >= 1 ? n : 1
}

async function buscarProdutos(q: string) {
  const wsId = workspaceId.value
  if (!wsId) return
  buscando.value = true
  try {
    const res = await $fetch<ProdutosBuscaResponse>('/api/produtos/buscar', {
      method: 'GET',
      query: {
        workspace_id: wsId,
        page: 1,
        page_size: 12,
        ...(q ? { q } : {}),
      },
    })
    buscaItens.value = res.data ?? []
    painelBuscaAberto.value = true
  } catch (err) {
    buscaItens.value = []
    toast.error(mensagemErroFetch(err, 'Não foi possível buscar produtos.'))
  } finally {
    buscando.value = false
  }
}

function onInputBusca() {
  if (buscaTimer) clearTimeout(buscaTimer)
  const q = buscaTexto.value.trim()
  buscaTimer = setTimeout(() => {
    void buscarProdutos(q)
  }, 280)
}

function onFocusBusca() {
  if (buscaItens.value.length > 0) {
    painelBuscaAberto.value = true
    return
  }
  void buscarProdutos(buscaTexto.value.trim())
}

async function criarPedido() {
  const wsId = workspaceId.value
  const canalId = props.canalId
  const key = props.conversaKey?.trim()
  if (!wsId || !canalId || !key || !podeCriar.value) return

  criando.value = true
  try {
    const res = await kanban.criarNotificacaoPedidoPronto({
      workspaceId: wsId,
      canalId,
      conversaKey: key,
      produtos: linhas.value.map((l) => ({
        nome: l.nome.trim(),
        qtd: l.qtd,
        preco: l.preco,
      })),
      formaPagamento: formaPagamento.value.trim(),
      nome: props.clienteNome ?? null,
      fone: props.clienteTelefone ?? null,
    })

    toast.success('Pedido em preparação', {
      description: 'O pedido foi criado e está em preparação.',
    })
    emit('criado', res.notificacao)

    // Move conversa para coluna ordem 4 (Em Separação).
    void kanban.moverConversaParaColunaOrdem({
      workspaceId: wsId,
      conversaKey: key,
      ordem: 4,
    })

    if (imprimirAoCriar.value) {
      imprimirCupomPedido({
        item: res.notificacao,
        lojaNome: lojaNome.value,
        clienteNome: props.clienteNome ?? null,
        clienteTelefone: props.clienteTelefone ?? null,
        canalNome: props.canalNome ?? null,
      })
    }

    open.value = false
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar o pedido.'))
  } finally {
    criando.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Criar pedido pronto"
    panel-class="w-full max-w-lg"
    body-class="max-h-[min(75vh,36rem)] overflow-y-auto"
  >
    <div class="space-y-5">
      <!-- Busca produtos -->
      <div class="relative space-y-2">
        <label class="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Produtos
        </label>
        <input
          v-model="buscaTexto"
          type="search"
          autocomplete="off"
          placeholder="Buscar produto para adicionar…"
          class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          :disabled="criando || !workspaceId"
          @input="onInputBusca"
          @focus="onFocusBusca"
        />

        <div
          v-if="painelBuscaAberto && (buscaItens.length > 0 || buscando)"
          class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-outline/40 bg-surface-container-lowest shadow-lg dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        >
          <p
            v-if="buscando"
            class="px-3 py-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Buscando…
          </p>
          <button
            v-for="p in buscaItens"
            :key="p.id"
            type="button"
            class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
            @mousedown.prevent="adicionarProduto(p)"
          >
            <span class="min-w-0 truncate font-medium text-on-surface dark:text-dark-on-surface">
              {{ p.nome }}
            </span>
            <span class="shrink-0 tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ formatMoedaBr(precoProduto(p)) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Linhas selecionadas -->
      <div v-if="linhas.length" class="space-y-2">
        <div
          v-for="linha in linhas"
          :key="linha.key"
          class="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2 rounded-xl border border-outline/30 px-3 py-2 dark:border-dark-outline/30"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              {{ linha.nome }}
            </p>
            <p class="text-xs tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ formatMoedaBr(linha.preco) }} un.
            </p>
          </div>
          <input
            type="number"
            min="1"
            step="1"
            class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1.5 text-center text-sm tabular-nums text-on-surface focus:border-primary-500 focus:outline-none dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :value="linha.qtd"
            :disabled="criando"
            aria-label="Quantidade"
            @input="setQtd(linha.key, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            :disabled="criando"
            aria-label="Remover produto"
            @click="removerLinha(linha.key)"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
          </button>
        </div>

        <div class="flex items-baseline justify-between gap-3 pt-1">
          <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
            Total
          </span>
          <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatMoedaBr(totalOrcamento) }}
          </span>
        </div>
      </div>
      <p
        v-else
        class="rounded-xl border border-dashed border-outline/35 px-3 py-4 text-center text-sm text-on-surface-variant dark:border-dark-outline/35 dark:text-dark-on-surface-variant"
      >
        Nenhum produto adicionado.
      </p>

      <!-- Forma de pagamento -->
      <div class="space-y-2">
        <label class="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Forma de pagamento
        </label>
        <input
          v-model="formaPagamento"
          type="text"
          autocomplete="off"
          placeholder="Ex.: PIX, Dinheiro…"
          class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          :disabled="criando"
        />
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="sug in FORMAS_SUGESTAO"
            :key="sug"
            type="button"
            class="rounded-full border border-outline/35 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-700 dark:border-dark-outline/35 dark:text-dark-on-surface-variant dark:hover:text-primary-300"
            :disabled="criando"
            @click="formaPagamento = sug"
          >
            {{ sug }}
          </button>
        </div>
      </div>

      <label class="inline-flex cursor-pointer items-center gap-2.5 select-none">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-outline/50 text-primary-600 focus:ring-primary-500/30 dark:border-dark-outline/50"
          :checked="imprimirAoCriar"
          :disabled="criando"
          @change="onChangeImprimir"
        />
        <span class="text-sm text-on-surface dark:text-dark-on-surface">
          Imprimir pedido ao criar
        </span>
      </label>

      <p
        v-if="!canalId"
        class="text-xs text-red-600 dark:text-red-400"
      >
        Esta conversa não tem canal vinculado. Não é possível criar o pedido.
      </p>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        :disabled="criando"
        @click="open = false"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
        :disabled="!podeCriar"
        @click="criarPedido"
      >
        {{ criando ? 'Criando…' : 'Criar' }}
      </button>
    </template>
  </BaseModal>
</template>
