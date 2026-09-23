<script setup lang="ts">
import { toast } from 'vue-sonner'
import type {
  ProdutoWorkspaceCampos,
  ProdutoWorkspaceItem,
  ProdutoWorkspacePatch,
} from '#shared/types/produtos'
import ProdutosSelecaoMultipla from '~/components/produtos/selecao-multipla/ProdutosSelecaoMultipla.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const props = withDefaults(
  defineProps<{
    row: ProdutoWorkspaceCampos
    tipo: 'pai' | 'variacao'
    pai?: ProdutoWorkspaceItem | null
    workspaceId?: number | null
    selecionado?: boolean
    mostrarSelecao?: boolean
    desabilitado?: boolean
    mostrarImagens?: boolean
    temVariacoesVisiveis?: boolean
    expandido?: boolean
    salvandoVariacao?: boolean
    urlImagem?: string | null
    contagemImagens?: number
    resumoVariacao?: string
    /** Mostra botão "+" de nova variação (só faz sentido na listagem API). */
    mostrarNovaVariacao?: boolean
    /** Controles de ordem (arrastar) no termo ativo. */
    mostrarOrdem?: boolean
    reordenando?: boolean
  }>(),
  {
    pai: null,
    workspaceId: null,
    selecionado: false,
    mostrarSelecao: true,
    desabilitado: false,
    mostrarImagens: true,
    temVariacoesVisiveis: false,
    expandido: false,
    salvandoVariacao: false,
    urlImagem: null,
    contagemImagens: 0,
    resumoVariacao: '',
    mostrarNovaVariacao: true,
    mostrarOrdem: false,
    reordenando: false,
  },
)

const emit = defineEmits<{
  'toggle-selecionado': [checked: boolean]
  'toggle-status': []
  'toggle-expandir': []
  'abrir-imagens': []
  'nova-variacao': []
  editar: []
  apagar: []
  'commit-termo': [patch: ProdutoWorkspacePatch]
  commit: [patch: ProdutoWorkspacePatch]
  'drag-start': [ev: DragEvent]
  'drag-over': [ev: DragEvent]
  drop: [ev: DragEvent]
  'drag-end': [ev: DragEvent]
}>()

function onHandleDragStart(ev: DragEvent) {
  if (props.desabilitado || props.reordenando || !props.mostrarOrdem) {
    ev.preventDefault()
    return
  }
  emit('drag-start', ev)
}

const inputClass =
  'w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:hover:border-zinc-700 dark:focus:border-zinc-600 dark:focus:bg-zinc-950 dark:focus:ring-dark-primary/20'

const inputPrecoClass = `${inputClass} font-semibold tabular-nums`

function fmtPrecoCampo(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function eqNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 1e-9
}

function onBlurNome(ev: Event) {
  if (props.desabilitado) return
  const v = (ev.target as HTMLInputElement).value.trim()
  if (!v) {
    toast.error('O nome não pode ser vazio.')
    ;(ev.target as HTMLInputElement).value = props.row.nome ?? ''
    return
  }
  if (v === (props.row.nome ?? '').trim()) return
  emit('commit', { nome: v })
}

function onBlurUnidade(ev: Event) {
  if (props.desabilitado) return
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (props.row.unidade_venda ?? '').trim()
  if (v === atual) return
  emit('commit', { unidade_venda: v.length ? v : null })
}

function onBlurPreco(ev: Event) {
  if (props.desabilitado) return
  const input = ev.target as HTMLInputElement
  const raw = input.value.trim()
  if (!raw.length) {
    if (props.row.preco == null) return
    emit('commit', { preco: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Preço à vista inválido.')
    input.value = fmtPrecoCampo(props.row.preco)
    return
  }
  if (eqNum(n, props.row.preco)) {
    input.value = fmtPrecoCampo(props.row.preco)
    return
  }
  emit('commit', { preco: n })
}

function onBlurPrecoPrazo(ev: Event) {
  if (props.desabilitado) return
  const input = ev.target as HTMLInputElement
  const raw = input.value.trim()
  if (!raw.length) {
    if (props.row.preco_prazo == null) return
    emit('commit', { preco_prazo: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Preço a prazo inválido.')
    input.value = fmtPrecoCampo(props.row.preco_prazo)
    return
  }
  if (eqNum(n, props.row.preco_prazo)) {
    input.value = fmtPrecoCampo(props.row.preco_prazo)
    return
  }
  emit('commit', { preco_prazo: n })
}

const checkboxVisualBaseClass =
  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 ease-out'
</script>

<template>
  <div
    class="group/item flex flex-col gap-3 border-b border-zinc-200 px-3 py-3 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
    :class="
      tipo === 'variacao'
        ? 'border-l-2 border-l-zinc-300 bg-zinc-50/70 pl-4 dark:border-l-zinc-600 dark:bg-zinc-900/40'
        : ''
    "
    @dragover="emit('drag-over', $event)"
    @drop="emit('drop', $event)"
    @dragend="emit('drag-end', $event)"
  >
    <!-- Esquerda: alça de arrastar + seleção + expandir + foto/ativar + nome/termo -->
    <div class="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3">
      <button
        v-if="mostrarOrdem && tipo === 'pai'"
        type="button"
        class="inline-flex h-9 w-6 shrink-0 cursor-grab items-center justify-center self-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        :disabled="desabilitado || reordenando"
        draggable="true"
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
        @click.stop
        @dragstart.stop="onHandleDragStart"
      >
        <span class="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">
          drag_indicator
        </span>
      </button>

      <label
        v-if="mostrarSelecao"
        class="group/check flex shrink-0 cursor-pointer items-center justify-center self-center py-1"
        :class="desabilitado ? 'cursor-not-allowed opacity-40' : ''"
        @click.stop
      >
        <span
          :class="[
            checkboxVisualBaseClass,
            selecionado
              ? 'border-[#2383e2] bg-[#2383e2] opacity-100'
              : 'border-zinc-300/90 bg-white opacity-0 group-hover/item:opacity-100 group-hover/check:opacity-100 dark:border-zinc-600 dark:bg-zinc-950',
          ]"
          aria-hidden="true"
        >
          <svg
            v-if="selecionado"
            class="h-3 w-3 text-white"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2.25 6.25L4.75 8.75L9.75 3.25"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <input
          type="checkbox"
          class="sr-only"
          :checked="selecionado"
          :disabled="desabilitado"
          :aria-label="'Selecionar produto ' + row.nome"
          @change="emit('toggle-selecionado', ($event.target as HTMLInputElement).checked)"
        >
      </label>

      <button
        v-if="tipo === 'pai' && temVariacoesVisiveis"
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
        :aria-expanded="expandido"
        :aria-label="expandido ? 'Recolher variações' : 'Expandir variações'"
        @click.stop="emit('toggle-expandir')"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
          {{ expandido ? 'expand_less' : 'expand_more' }}
        </span>
      </button>

      <!-- Foto + ativar (esquerda) -->
      <div class="flex shrink-0 flex-col items-center gap-1.5">
        <button
          v-if="mostrarImagens"
          type="button"
          class="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
          :disabled="desabilitado"
          :aria-label="'Gerir imagens de ' + row.nome"
          title="Alterar foto"
          @click.stop="emit('abrir-imagens')"
        >
          <img
            v-if="urlImagem"
            :src="urlImagem"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
          >
          <span v-else class="material-symbols-outlined text-[28px]" aria-hidden="true">photo</span>
          <span
            v-if="contagemImagens > 1"
            class="absolute bottom-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-700 px-1 text-[9px] font-bold leading-none text-white dark:bg-zinc-300 dark:text-zinc-900"
          >
            {{ contagemImagens }}
          </span>
        </button>

        <button
          type="button"
          role="switch"
          :aria-checked="row.status"
          :disabled="desabilitado"
          class="group relative isolate inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950"
          :class="
            row.status
              ? 'bg-primary-600 shadow-inner shadow-primary-900/25 dark:bg-primary-500'
              : 'bg-zinc-400 dark:bg-zinc-600'
          "
          :aria-label="row.status ? 'Desativar produto' : 'Ativar produto'"
          :title="row.status ? 'Ativo' : 'Inativo'"
          @click.stop="emit('toggle-status')"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-white/10"
            :class="row.status ? 'left-[calc(100%-1rem)]' : 'left-0.5'"
          />
        </button>
      </div>

      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex min-w-0 items-center gap-1.5">
          <input
            type="text"
            :value="row.nome ?? ''"
            :disabled="desabilitado"
            placeholder="Nome do produto"
            :class="[
              inputClass,
              'flex-1 text-[15px] font-bold leading-snug',
              row.nome?.trim() ? '' : 'text-zinc-400 dark:text-zinc-500',
            ]"
            data-campo-produto="nome"
            @click.stop
            @blur="onBlurNome"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          >
          <span
            v-if="tipo === 'pai' && temVariacoesVisiveis && pai"
            class="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {{ pai.variacoes.length }}
          </span>
          <button
            v-if="tipo === 'pai' && mostrarNovaVariacao"
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-emerald-100/90 hover:text-emerald-700 focus-visible:opacity-100 group-hover/item:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
            :disabled="desabilitado || salvandoVariacao"
            title="Adicionar variação"
            aria-label="Adicionar variação de produto"
            @click.stop="emit('nova-variacao')"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          </button>
        </div>

        <p
          v-if="tipo === 'variacao' && resumoVariacao"
          class="truncate text-[11px] font-medium leading-tight text-zinc-500 dark:text-zinc-400"
        >
          {{ resumoVariacao }}
        </p>

        <div
          v-else
          class="item-tabela-termo w-fit max-w-full min-w-0"
          @click.stop
        >
          <ProdutosSelecaoMultipla
            compact
            :workspace-id="workspaceId"
            :produto-id="row.id"
            :termos="row.termos_pesquisa ?? []"
            :disabled="desabilitado"
            @commit="emit('commit-termo', $event)"
          />
        </div>
      </div>
    </div>

    <!-- Direita: unidade + preços + ações -->
    <div
      class="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 pl-0 sm:w-auto sm:max-w-md sm:flex-nowrap sm:justify-end sm:gap-4 sm:pl-2"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-none sm:gap-4">
        <div class="min-w-[5.5rem] max-w-[7rem] flex-1 space-y-0.5 sm:flex-none">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Unidade
          </p>
          <input
            type="text"
            :value="row.unidade_venda ?? ''"
            :disabled="desabilitado"
            placeholder="—"
            :class="[inputClass, 'font-semibold']"
            data-campo-produto="unidade_venda"
            @click.stop
            @blur="onBlurUnidade"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          >
        </div>
        <div class="min-w-[6rem] max-w-[8rem] flex-1 space-y-0.5 sm:flex-none">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            À vista
          </p>
          <input
            type="text"
            inputmode="decimal"
            :value="fmtPrecoCampo(row.preco)"
            :disabled="desabilitado"
            placeholder="—"
            :class="inputPrecoClass"
            data-campo-produto="preco"
            @click.stop
            @blur="onBlurPreco"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          >
        </div>
        <div class="min-w-[6rem] max-w-[8rem] flex-1 space-y-0.5 sm:flex-none">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            A prazo
          </p>
          <input
            type="text"
            inputmode="decimal"
            :value="fmtPrecoCampo(row.preco_prazo)"
            :disabled="desabilitado"
            placeholder="—"
            :class="inputPrecoClass"
            data-campo-produto="preco_prazo"
            @click.stop
            @blur="onBlurPrecoPrazo"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          >
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
          :disabled="desabilitado"
          aria-label="Editar produto"
          title="Editar"
          @click.stop="emit('editar')"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
        </button>

        <BaseDropdown
          title="Ações"
          align="right"
          side="bottom"
          panel-class="w-48 min-w-[12rem]"
          :teleport="true"
        >
          <template #trigger>
            <span
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              :class="desabilitado ? 'pointer-events-none opacity-50' : ''"
              aria-label="Ações do produto"
              title="Ações"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">more_vert</span>
            </span>
          </template>
          <template #default="{ close }">
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              :disabled="desabilitado"
              @click="close(); emit('editar')"
            >
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">edit</span>
              Editar completo
            </button>
            <button
              type="button"
              role="menuitem"
              class="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
              :disabled="desabilitado"
              @click="close(); emit('apagar')"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
              Apagar
            </button>
          </template>
        </BaseDropdown>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-tabela-termo :deep(.relative > div.flex:hover) {
  background-color: transparent;
}
</style>
