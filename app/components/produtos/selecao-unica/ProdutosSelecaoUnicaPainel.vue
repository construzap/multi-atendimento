<script setup lang="ts">
import { ref } from 'vue'
import type { ConfigSelecaoUnica, ItemSelecaoUnica } from './produtosSelecaoUnicaConfig'

withDefaults(
  defineProps<{
    config: ConfigSelecaoUnica
    buscando: boolean
    sugestoes: ItemSelecaoUnica[]
    mostrarOpcaoCriar: boolean
    criando: boolean
    editandoItemId: number | null
    guardandoEdicao: boolean
    eliminandoId: number | null
    disabled: boolean
    indiceDestaque: number
    mostrarFiltro?: boolean
    inpFiltroClass: string
    inpEdicaoClass: string
    iconAcaoClass: string
    painelHeaderClass: string
    itemSugestaoClass: (idx: number) => string
  }>(),
  { mostrarFiltro: true },
)

const filtro = defineModel<string>('filtro', { required: true })
const nomeEdicao = defineModel<string>('nomeEdicao', { required: true })
const listaSugestoesRef = defineModel<HTMLUListElement | null>('listaSugestoesRef', { default: null })

const inputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  fechar: []
  enterFiltro: []
  escolher: [item: ItemSelecaoUnica]
  iniciarEdicao: [item: ItemSelecaoUnica]
  confirmarEdicao: [id: number]
  cancelarEdicao: []
  eliminar: [item: ItemSelecaoUnica]
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

  <div v-if="mostrarFiltro" class="shrink-0 border-b border-slate-700/60 px-3 py-2">
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
          :class="itemSugestaoClass(idx)"
          @mouseenter="emit('hoverDestaque', idx)"
          @mousedown.prevent="emit('escolher', item)"
        >
          <span class="block min-w-0 truncate">{{ item.nome }}</span>
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
    <p class="mb-2 text-xs text-slate-400">
      Nenhum resultado para «<span class="font-semibold text-slate-200">{{ filtro.trim() }}</span>».
    </p>
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
