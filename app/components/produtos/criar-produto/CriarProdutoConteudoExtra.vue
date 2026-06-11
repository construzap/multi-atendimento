<script setup lang="ts">
import { ref } from 'vue'
import BaseInput from '~/components/BaseInput.vue'
import { labelClass, secaoClass, tituloSecaoClass } from './criarProdutoUi'

const props = withDefaults(
  defineProps<{
    idPrefix?: string
  }>(),
  { idPrefix: 'criar-produto' },
)

const codigoBarras = defineModel<string>('codigoBarras', { default: '' })
const tags = defineModel<string[]>('tags', { default: () => ['Cimento', 'Construção'] })

const tagInput = ref('')

const id = (s: string) => `${props.idPrefix}-${s}`

function adicionarTag() {
  const t = tagInput.value.trim()
  if (!t) return
  if (!tags.value.includes(t)) {
    tags.value = [...tags.value, t]
  }
  tagInput.value = ''
}

function removerTag(index: number) {
  tags.value = tags.value.filter((_, i) => i !== index)
}

function onTagKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter') {
    ev.preventDefault()
    adicionarTag()
  }
}
</script>

<template>
  <section :class="secaoClass">
    <h2 :class="[tituloSecaoClass, 'mb-6']">
      <span class="material-symbols-outlined text-primary-600 dark:text-primary-400" aria-hidden="true">add_box</span>
      Conteúdo Extra
    </h2>

    <div class="space-y-4">
      <div>
        <label :for="id('ean')" :class="labelClass">Código de Barras (EAN)</label>
        <BaseInput :id="id('ean')" v-model="codigoBarras" placeholder="7891234567890" autocomplete="off" />
      </div>
      <div>
        <label :for="id('tags-input')" :class="labelClass">Termos de Pesquisa (Tags)</label>
        <div
          class="min-h-[80px] rounded-lg border border-outline/40 bg-surface-container-lowest p-2 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest"
        >
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(tag, i) in tags"
              :key="tag + i"
              class="inline-flex items-center gap-1 rounded-md bg-secondary-container px-2 py-1 text-xs font-medium text-on-secondary-container dark:bg-dark-secondary-container dark:text-dark-on-secondary-container"
            >
              {{ tag }}
              <button
                type="button"
                class="inline-flex text-on-secondary-container/80 hover:text-on-secondary-container dark:text-dark-on-secondary-container/80"
                :aria-label="'Remover tag ' + tag"
                @click="removerTag(i)"
              >
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
            <input
              :id="id('tags-input')"
              v-model="tagInput"
              type="text"
              class="min-w-[60px] flex-1 border-none bg-transparent p-1 text-sm text-on-surface focus:ring-0 dark:text-dark-on-surface"
              placeholder="Add…"
              autocomplete="off"
              @keydown="onTagKeydown"
              @blur="adicionarTag"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
