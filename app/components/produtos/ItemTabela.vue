<script setup lang="ts">
import { computed } from 'vue'
import type {
  ProdutoWorkspaceCampos,
  ProdutoWorkspaceItem,
  ProdutoWorkspacePatch,
} from '#shared/types/produtos'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'

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
  },
)

const emit = defineEmits<{
  'toggle-selecionado': [checked: boolean]
  'toggle-status': []
  'toggle-expandir': []
  'abrir-imagens': []
  'nova-variacao': []
  editar: []
  'commit-termo': [patch: ProdutoWorkspacePatch]
}>()

function fmtPreco(val: number | null | undefined): string {
  if (val == null || val === 0) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

const unidadeExibida = computed(() => {
  const u = (props.row.unidade_venda ?? '').trim()
  return u || '—'
})

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
  >
    <!-- Esquerda: seleção + expandir + foto + nome/termo/toggle -->
    <div class="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3">
      <!-- Checkbox -->
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
        />
      </label>

      <!-- Expandir variações -->
      <button
        v-if="tipo === 'pai' && temVariacoesVisiveis"
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-700"
        :aria-expanded="expandido"
        :aria-label="expandido ? 'Recolher variações' : 'Expandir variações'"
        @click.stop="emit('toggle-expandir')"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
          {{ expandido ? 'expand_more' : 'chevron_right' }}
        </span>
      </button>
      <span
        v-else-if="tipo === 'variacao'"
        class="material-symbols-outlined w-7 shrink-0 self-center text-center text-[16px] text-zinc-400 dark:text-zinc-500"
        aria-hidden="true"
      >
        subdirectory_arrow_right
      </span>
      <span v-else class="hidden w-7 shrink-0 sm:block" aria-hidden="true" />

      <!-- Foto -->
      <button
        v-if="mostrarImagens"
        type="button"
        class="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
        :disabled="desabilitado"
        :aria-label="'Gerir imagens de ' + row.nome"
        :title="contagemImagens === 0 ? 'Adicionar imagem' : contagemImagens + ' foto(s)'"
        @click.stop="emit('abrir-imagens')"
      >
        <img
          v-if="urlImagem"
          :src="urlImagem"
          alt=""
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <span v-else class="material-symbols-outlined text-[28px]" aria-hidden="true">photo</span>
        <span
          v-if="contagemImagens > 1"
          class="absolute bottom-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-700 px-1 text-[9px] font-bold leading-none text-white dark:bg-zinc-300 dark:text-zinc-900"
        >
          {{ contagemImagens }}
        </span>
      </button>

      <!-- Nome + termo + toggle -->
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex min-w-0 items-center gap-1.5">
          <p
            class="truncate text-[15px] font-bold leading-snug text-zinc-900 dark:text-zinc-50"
            :title="row.nome"
          >
            {{ row.nome }}
          </p>
          <span
            v-if="tipo === 'pai' && temVariacoesVisiveis && pai"
            class="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {{ pai.variacoes.length }}
          </span>
          <button
            v-if="tipo === 'pai'"
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
          class="item-tabela-termo max-w-full min-w-0"
          @click.stop
        >
          <ProdutosSelecaoUnica
            catalogo="termos_pesquisa"
            variant="celula"
            :workspace-id="workspaceId"
            :produto-id="row.id"
            :termo-id="row.termos_pesquisa?.[0]?.id ?? null"
            :termo-nome="row.termos_pesquisa?.[0]?.nome ?? row.termos_pesquisa_busca ?? null"
            :disabled="desabilitado"
            @commit="emit('commit-termo', $event)"
          />
        </div>

        <!-- Toggle status -->
        <div class="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            role="switch"
            :aria-checked="row.status"
            :disabled="desabilitado"
            class="group relative isolate inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950"
            :class="
              row.status
                ? 'bg-primary-600 shadow-inner shadow-primary-900/25 dark:bg-primary-500'
                : 'bg-zinc-400 dark:bg-zinc-600'
            "
            :aria-label="row.status ? 'Desativar produto' : 'Ativar produto'"
            @click.stop="emit('toggle-status')"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-white/10"
              :class="row.status ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"
            />
          </button>
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Ativar produto
          </span>
        </div>
      </div>
    </div>

    <!-- Centro/direita: unidade + preços + menu -->
    <div
      class="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 pl-0 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-5 sm:pl-2"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-4 sm:flex-none sm:gap-6">
        <div class="min-w-[4.5rem] space-y-0.5">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Unidade
          </p>
          <p class="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {{ unidadeExibida }}
          </p>
        </div>
        <div class="min-w-[5.5rem] space-y-0.5">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            À vista
          </p>
          <p class="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {{ fmtPreco(row.preco) }}
          </p>
        </div>
        <div class="min-w-[5.5rem] space-y-0.5">
          <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            A prazo
          </p>
          <p class="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {{ fmtPreco(row.preco_prazo) }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        :disabled="desabilitado"
        aria-label="Editar produto"
        title="Editar produto"
        @click.stop="emit('editar')"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">more_vert</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Compacta o seletor de termo para caber no card (pill sob o nome). */
.item-tabela-termo :deep(.relative > div.flex) {
  min-height: 0;
  padding: 0;
  gap: 0.25rem;
}
.item-tabela-termo :deep(.relative > div.flex:hover) {
  background-color: transparent;
}
</style>
