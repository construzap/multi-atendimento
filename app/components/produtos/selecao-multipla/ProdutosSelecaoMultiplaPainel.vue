<script setup lang="ts">
import { ref } from 'vue'
import { CONFIG_SELECAO_MULTIPLA, type ItemSelecaoMultipla } from './produtosSelecaoMultiplaConfig'

defineProps<{
  buscando: boolean
  sugestoes: ItemSelecaoMultipla[]
  mostrarOpcaoCriar: boolean
  criando: boolean
  editandoItemId: number | null
  guardandoEdicao: boolean
  eliminandoId: number | null
  disabled: boolean
  indiceDestaque: number
  inpFiltroClass: string
  inpEdicaoClass: string
  iconAcaoClass: string
  painelHeaderClass: string
  itemSugestaoClass: (idx: number, sel: boolean) => string
  estaSelecionado: (id: number) => boolean
}>()

const filtro = defineModel<string>('filtro', { required: true })
const nomeEdicao = defineModel<string>('nomeEdicao', { required: true })
const listaSugestoesRef = defineModel<HTMLUListElement | null>('listaSugestoesRef', { default: null })

const inputRef = ref<HTMLInputElement | null>(null)
const config = CONFIG_SELECAO_MULTIPLA

function focusFiltro() {
  inputRef.value?.focus()
}

defineExpose({ focusFiltro })

const emit = defineEmits<{
  fechar: []
  enterFiltro: []
  toggle: [item: ItemSelecaoMultipla]
  iniciarEdicao: [item: ItemSelecaoMultipla]
  confirmarEdicao: [id: number]
  cancelarEdicao: []
  eliminar: [item: ItemSelecaoMultipla]
  criar: []
  hoverDestaque: [idx: number]
}>()
</script>

<template>
  <div :class="painelHeaderClass">
    <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ config.tituloPainel }}</span>
    <button
      type="button"
      class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
      aria-label="Fechar lista"
      @mousedown.prevent.stop="emit('fechar')"
    >
      <span class="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">close</span>
    </button>
  </div>

  <div class="shrink-0 border-b border-slate-700/60 px-3 py-2">
    <input
      ref="inputRef"
      v-model="filtro"
      type="text"
      autocomplete="off"
      autofocus
      :class="inpFiltroClass"
      :placeholder="config.placeholderFiltro"
      @keydown.enter.prevent="emit('enterFiltro')"
    />
  </div>

  <div v-if="buscando" class="px-4 py-3 text-sm text-slate-400">A procurar…</div>

  <ul v-else-if="sugestoes.length > 0" ref="listaSugestoesRef" class="min-h-0 flex-1 overflow-y-auto py-1">
    <li
      v-for="(item, idx) in sugestoes"
      :key="item.id"
      class="flex min-w-0 items-stretch gap-0.5 border-b border-slate-700/40 px-1 py-0.5 last:border-b-0"
    >
      <template v-if="editandoItemId === item.id">
        <input
          v-model="nomeEdicao"
          type="text"
          autocomplete="off"
          :class="inpEdicaoClass"
          :placeholder="config.placeholderEdicao"
          :disabled="guardandoEdicao"
          @mousedown.stop
          @keydown.enter.prevent="emit('confirmarEdicao', item.id)"
          @keydown.escape.prevent="emit('cancelarEdicao')"
        />
        <button type="button" :class="iconAcaoClass" aria-label="Guardar" :disabled="guardandoEdicao" @mousedown.stop.prevent="emit('confirmarEdicao', item.id)">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">check</span>
        </button>
        <button type="button" :class="iconAcaoClass" aria-label="Cancelar" @mousedown.stop.prevent="emit('cancelarEdicao')">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          role="option"
          :data-item-idx="idx"
          :aria-selected="estaSelecionado(item.id)"
          :class="itemSugestaoClass(idx, estaSelecionado(item.id))"
          @mouseenter="emit('hoverDestaque', idx)"
          @mousedown.prevent="emit('toggle', item)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
            :class="estaSelecionado(item.id) ? 'border-primary-400 bg-primary-500 text-white' : 'border-slate-500 bg-transparent'"
          >
            <span v-if="estaSelecionado(item.id)" class="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">check</span>
          </span>
          <span class="min-w-0 truncate">{{ item.nome }}</span>
        </button>
        <button type="button" :class="iconAcaoClass" aria-label="Editar" :disabled="disabled || eliminandoId === item.id" @mousedown.stop.prevent="emit('iniciarEdicao', item)">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
        </button>
        <button type="button" :class="iconAcaoClass" aria-label="Eliminar" :disabled="disabled || eliminandoId === item.id" @mousedown.stop.prevent="emit('eliminar', item)">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </template>
    </li>
  </ul>

  <div v-else-if="mostrarOpcaoCriar" class="border-t border-slate-600/80 px-4 py-3">
    <button
      type="button"
      class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/70 bg-amber-200/95 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
      :disabled="criando"
      @mousedown.prevent="emit('criar')"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
      {{ criando ? 'A criar…' : `Criar «${filtro.trim()}»` }}
    </button>
  </div>

  <div v-else class="px-4 py-3 text-sm text-slate-400">{{ config.placeholderFiltro }}</div>
</template>
