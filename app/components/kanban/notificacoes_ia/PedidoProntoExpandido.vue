<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import type { ProdutoWorkspaceItem, ProdutosBuscaResponse } from '#shared/types/produtos'
import EntregaNavegacaoMapas from '~/components/entregadores/EntregaNavegacaoMapas.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'
import { parseCoordenadasValidas, parseLatLngTexto } from '#shared/utils/navegacaoMapas'
import {
  formatMoedaBr,
  normalizeTotalOrcamento,
  parseProdutosNotificacao,
  subtotalLinhaExibicao,
} from './parseProdutosNotificacao'

type LinhaPedidoEditar = {
  key: string
  produtoId: number | null
  nome: string
  qtd: number
  preco: number
  precoPrazo: number
}

const STORAGE_KEY = 'kanban.notificacoes_ia.imprimir_ao_aceitar'

const FORMAS_SUGESTAO = [
  'Pagamento a vista',
  'PIX',
  'Dinheiro',
  'Cartão de crédito',
  'Cartão de débito',
]

const props = defineProps<{
  item: KanbanNotificacaoIa
  conversaKey: string
  busy?: boolean
}>()

const emit = defineEmits<{
  aceitar: [payload: { imprimir: boolean }]
  rejeitar: []
  imprimir: []
  atualizado: [notificacao: KanbanNotificacaoIa]
}>()

const kanban = useKanbanStore()
const workspaces = useWorkspacesStore()

const emSeparacao = computed(
  () => (props.item.entrega_status ?? '').trim().toLowerCase() === 'separacao',
)

const produtos = computed(() => parseProdutosNotificacao(props.item.produtos))
const totais = computed(() => normalizeTotalOrcamento(props.item.total_orcamento))

const enderecoExibicao = computed(() => props.item.endereco?.trim() || null)

const temCoordenadasNavegacao = computed(
  () => parseCoordenadasValidas(props.item.latitude, props.item.longitude) != null,
)

const workspaceId = computed(() => {
  const n = Number.parseInt(String(workspaces.currentWorkspaceId ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const editando = ref(false)
const salvando = ref(false)
const linhas = ref<LinhaPedidoEditar[]>([])
const formaPagamento = ref('')
const endereco = ref('')
const coordenadas = ref('')

const buscaTexto = ref('')
const buscaItens = ref<ProdutoWorkspaceItem[]>([])
const buscando = ref(false)
const painelBuscaAberto = ref(false)
const buscaRootEl = ref<HTMLElement | null>(null)
let buscaTimer: ReturnType<typeof setTimeout> | null = null

function fecharPainelBusca() {
  painelBuscaAberto.value = false
}

function onPointerDownForaBusca(e: PointerEvent) {
  if (!painelBuscaAberto.value) return
  const root = buscaRootEl.value
  const target = e.target
  if (!(target instanceof Node) || !root) {
    fecharPainelBusca()
    return
  }
  if (!root.contains(target)) fecharPainelBusca()
}

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('pointerdown', onPointerDownForaBusca, true)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onPointerDownForaBusca, true)
  if (buscaTimer) clearTimeout(buscaTimer)
})

const totalVistaEdit = computed(() =>
  linhas.value.reduce((acc, l) => acc + Math.max(0, l.qtd) * Math.max(0, l.preco), 0),
)

const totalPrazoEdit = computed(() =>
  linhas.value.reduce(
    (acc, l) => acc + Math.max(0, l.qtd) * Math.max(0, l.precoPrazo),
    0,
  ),
)

const podeSalvar = computed(() => {
  if (salvando.value || props.busy) return false
  if (!workspaceId.value) return false
  if (!props.conversaKey?.trim()) return false
  if (!formaPagamento.value.trim()) return false
  if (linhas.value.length === 0) return false
  return linhas.value.every((l) => l.nome.trim() && l.qtd >= 1 && l.preco >= 0)
})

const acoesBloqueadas = computed(() => props.busy === true || editando.value || salvando.value)

function lerPreferenciaImprimir(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const imprimirAoAceitar = ref(lerPreferenciaImprimir())

function onChangeImprimir(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  imprimirAoAceitar.value = checked
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, checked ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function onAceitar() {
  emit('aceitar', { imprimir: imprimirAoAceitar.value === true })
}

function linhaSubtotal(p: (typeof produtos.value)[number]): string {
  const sub = subtotalLinhaExibicao(p, props.item.forma_pagamento)
  return sub != null ? formatMoedaBr(sub) : '—'
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatCoordsFromItem(item: KanbanNotificacaoIa): string {
  const coords = parseCoordenadasValidas(item.latitude, item.longitude)
  if (!coords) return ''
  return `${coords.lat}, ${coords.lng}`
}

function hidratarFormularioDoItem() {
  const parsed = parseProdutosNotificacao(props.item.produtos)
  linhas.value = parsed.map((p) => {
    const vista = p.preco_vista ?? p.preco ?? 0
    const prazo = p.preco_prazo ?? vista
    return {
      key: uid(),
      produtoId: null,
      nome: p.nome?.trim() || 'Produto',
      qtd: p.qtd != null && p.qtd >= 1 ? Math.trunc(p.qtd) : 1,
      preco: Number.isFinite(vista) ? Math.max(0, vista) : 0,
      precoPrazo: Number.isFinite(prazo) ? Math.max(0, prazo) : 0,
    }
  })
  formaPagamento.value = props.item.forma_pagamento?.trim() || ''
  endereco.value = props.item.endereco?.trim() || ''
  coordenadas.value = formatCoordsFromItem(props.item)
  buscaTexto.value = ''
  buscaItens.value = []
  painelBuscaAberto.value = false
}

function iniciarEdicao() {
  if (acoesBloqueadas.value && !editando.value) return
  if (props.busy || salvando.value) return
  hidratarFormularioDoItem()
  editando.value = true
}

function cancelarEdicao() {
  if (salvando.value) return
  editando.value = false
  linhas.value = []
  buscaTexto.value = ''
  buscaItens.value = []
  painelBuscaAberto.value = false
}

watch(
  () => props.item.id,
  () => {
    if (editando.value) cancelarEdicao()
  },
)

function precoVistaProduto(p: ProdutoWorkspaceItem): number {
  const promo = p.preco_promocional
  if (promo != null && Number.isFinite(Number(promo)) && Number(promo) > 0) {
    return Number(promo)
  }
  return Number.isFinite(Number(p.preco)) ? Number(p.preco) : 0
}

function precoPrazoProduto(p: ProdutoWorkspaceItem, vista: number): number {
  const prazo = p.preco_prazo
  if (prazo != null && Number.isFinite(Number(prazo)) && Number(prazo) >= 0) {
    return Number(prazo)
  }
  return vista
}

function adicionarProduto(p: ProdutoWorkspaceItem) {
  const existente = linhas.value.find((l) => l.produtoId === p.id)
  if (existente) {
    existente.qtd += 1
  } else {
    const vista = precoVistaProduto(p)
    linhas.value.push({
      key: uid(),
      produtoId: p.id,
      nome: p.nome?.trim() || `Produto #${p.id}`,
      qtd: 1,
      preco: vista,
      precoPrazo: precoPrazoProduto(p, vista),
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

async function salvarEdicao() {
  const wsId = workspaceId.value
  const key = props.conversaKey?.trim()
  if (!wsId || !key || !podeSalvar.value) return

  const coordsParsed = parseLatLngTexto(coordenadas.value)
  if (coordsParsed === undefined) {
    toast.error('Coordenadas inválidas. Use o formato: latitude, longitude')
    return
  }

  salvando.value = true
  try {
    const res = await kanban.atualizarNotificacaoPedidoPronto({
      workspaceId: wsId,
      conversaKey: key,
      notificacaoId: props.item.id,
      produtos: linhas.value.map((l) => ({
        nome: l.nome.trim(),
        nome_produto: l.nome.trim(),
        qtd: l.qtd,
        quantidade: l.qtd,
        preco: l.preco,
        preco_vista: l.preco,
        preco_prazo: l.precoPrazo,
      })),
      formaPagamento: formaPagamento.value.trim(),
      endereco: endereco.value.trim() || null,
      coordenadas: coordenadas.value.trim() || null,
      latitude: coordsParsed?.lat ?? null,
      longitude: coordsParsed?.lng ?? null,
    })

    toast.success('Pedido atualizado')
    emit('atualizado', res.notificacao)
    editando.value = false
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o pedido.'))
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Modo visualização -->
    <template v-if="!editando">
      <div class="flex items-center justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-500/10 disabled:opacity-60 dark:text-primary-300"
          :disabled="busy || salvando"
          @click="iniciarEdicao"
        >
          <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
            edit
          </span>
          Editar pedido
        </button>
      </div>

      <div v-if="produtos.length" class="space-y-3">
        <div
          v-for="(p, idx) in produtos"
          :key="idx"
          class="space-y-1 border-b border-outline/15 pb-3 last:border-0 last:pb-0 dark:border-dark-outline/15"
        >
          <div class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4">
            <p class="min-w-0 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              {{ p.nome }}
            </p>
            <p class="shrink-0 text-sm tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
              <template v-if="p.qtd != null">QTD: {{ p.qtd }}</template>
              <template v-else>—</template>
            </p>
            <p class="shrink-0 text-right text-sm font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
              {{ linhaSubtotal(p) }}
            </p>
          </div>
          <div
            v-if="p.preco_vista != null || p.preco_prazo != null"
            class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            <span v-if="p.preco_vista != null">
              À vista: {{ formatMoedaBr(p.preco_vista) }}
              <template v-if="p.subtotal_vista != null">
                ({{ formatMoedaBr(p.subtotal_vista) }})
              </template>
            </span>
            <span v-if="p.preco_prazo != null">
              Prazo: {{ formatMoedaBr(p.preco_prazo) }}
              <template v-if="p.subtotal_prazo != null">
                ({{ formatMoedaBr(p.subtotal_prazo) }})
              </template>
            </span>
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum produto listado.
      </p>

      <div class="space-y-2 border-t border-outline/30 pt-4 dark:border-dark-outline/30">
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
            Total à vista
          </span>
          <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatMoedaBr(totais.total_a_vista) }}
          </span>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
            Total a prazo
          </span>
          <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatMoedaBr(totais.total_a_prazo) }}
          </span>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Forma de pagamento
          </span>
          <span class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
            {{ item.forma_pagamento?.trim() || '—' }}
          </span>
        </div>
        <div v-if="enderecoExibicao" class="pt-1">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Endereço
          </p>
          <p class="mt-0.5 whitespace-pre-wrap text-sm text-on-surface dark:text-dark-on-surface">
            {{ enderecoExibicao }}
          </p>
        </div>
      </div>

      <div
        v-if="temCoordenadasNavegacao"
        class="border-t border-outline/30 pt-4 dark:border-dark-outline/30"
      >
        <EntregaNavegacaoMapas
          :latitude="item.latitude"
          :longitude="item.longitude"
          variant="kanban"
        />
      </div>
    </template>

    <!-- Modo edição -->
    <template v-else>
      <div ref="buscaRootEl" class="relative space-y-2">
        <label class="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Produtos
        </label>
        <input
          v-model="buscaTexto"
          type="search"
          autocomplete="off"
          placeholder="Buscar produto para adicionar…"
          class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          :disabled="salvando || !workspaceId"
          @input="onInputBusca"
          @focus="onFocusBusca"
          @keydown.escape.prevent="fecharPainelBusca"
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
              {{ formatMoedaBr(precoVistaProduto(p)) }}
            </span>
          </button>
        </div>
      </div>

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
              À vista {{ formatMoedaBr(linha.preco) }}
              <template v-if="linha.precoPrazo !== linha.preco">
                · Prazo {{ formatMoedaBr(linha.precoPrazo) }}
              </template>
            </p>
          </div>
          <input
            type="number"
            min="1"
            step="1"
            class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1.5 text-center text-sm tabular-nums text-on-surface focus:border-primary-500 focus:outline-none dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :value="linha.qtd"
            :disabled="salvando"
            aria-label="Quantidade"
            @input="setQtd(linha.key, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            :disabled="salvando"
            aria-label="Remover produto"
            @click="removerLinha(linha.key)"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
          </button>
        </div>

        <div class="space-y-1 pt-1">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
              Total à vista
            </span>
            <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
              {{ formatMoedaBr(totalVistaEdit) }}
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
              Total a prazo
            </span>
            <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
              {{ formatMoedaBr(totalPrazoEdit) }}
            </span>
          </div>
        </div>
      </div>
      <p
        v-else
        class="rounded-xl border border-dashed border-outline/35 px-3 py-4 text-center text-sm text-on-surface-variant dark:border-dark-outline/35 dark:text-dark-on-surface-variant"
      >
        Nenhum produto adicionado.
      </p>

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
          :disabled="salvando"
        />
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="sug in FORMAS_SUGESTAO"
            :key="sug"
            type="button"
            class="rounded-full border border-outline/35 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-700 dark:border-dark-outline/35 dark:text-dark-on-surface-variant dark:hover:text-primary-300"
            :disabled="salvando"
            @click="formaPagamento = sug"
          >
            {{ sug }}
          </button>
        </div>
      </div>

      <div class="space-y-3">
        <div class="space-y-2">
          <label class="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Endereço
          </label>
          <textarea
            v-model="endereco"
            rows="2"
            autocomplete="street-address"
            placeholder="Rua, número, bairro, cidade…"
            class="w-full resize-y rounded-xl border border-outline/45 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="salvando"
          />
        </div>
        <div class="space-y-2">
          <label class="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Latitude, longitude
          </label>
          <input
            v-model="coordenadas"
            type="text"
            autocomplete="off"
            placeholder="-12.890773090476822, -38.30699684520398"
            class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest px-3.5 py-2.5 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="salvando"
          />
          <p class="text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
            Cole no formato: latitude, longitude (separados por vírgula).
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
          :disabled="salvando"
          @click="cancelarEdicao"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          :disabled="!podeSalvar"
          @click="salvarEdicao"
        >
          {{ salvando ? 'Salvando…' : 'Salvar' }}
        </button>
      </div>
    </template>

    <template v-if="!editando">
      <label
        v-if="emSeparacao"
        class="inline-flex cursor-pointer items-center gap-2.5 select-none"
        :class="acoesBloqueadas ? 'pointer-events-none opacity-60' : ''"
      >
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-outline/50 text-primary-600 focus:ring-primary-500/30 dark:border-dark-outline/50"
          :checked="imprimirAoAceitar"
          :disabled="acoesBloqueadas"
          @change="onChangeImprimir"
        />
        <span class="text-sm text-on-surface dark:text-dark-on-surface">
          Imprimir pedido ao aceitar
        </span>
      </label>

      <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
        <template v-if="emSeparacao">
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
            :disabled="acoesBloqueadas"
            @click="emit('rejeitar')"
          >
            Rejeitar
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
            :disabled="acoesBloqueadas"
            @click="onAceitar"
          >
            Aceitar
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
            :disabled="acoesBloqueadas"
            @click="emit('rejeitar')"
          >
            Rejeitar
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
            :disabled="acoesBloqueadas"
            @click="emit('imprimir')"
          >
            <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
              print
            </span>
            Imprimir
          </button>
        </template>
      </div>
    </template>
  </div>
</template>
