<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '~/components/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    placeholder?: string
    /** Último termo já enviado à API (para mostrar «Pesquisar» ao alterar ou limpar o filtro). */
    termoAplicado?: string
  }>(),
  {
    placeholder: 'Buscar produtos pelo nome...',
    termoAplicado: '',
  },
)

const emit = defineEmits<{
  /** Disparado ao clicar em Pesquisar ou Enter; `q` é o texto trimado do input. */
  pesquisar: [q: string]
}>()

const model = defineModel<string>({ default: '' })

const mostrarPesquisar = computed(() => model.value.trim() !== (props.termoAplicado ?? '').trim())

function dispararPesquisa() {
  emit('pesquisar', model.value.trim())
}
</script>

<template>
  <div class="flex min-w-0 flex-1 items-stretch gap-2">
    <div class="relative min-w-0 flex-1">
      <span
        class="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
        aria-hidden="true"
      >
        search
      </span>
      <input
        v-model="model"
        type="search"
        autocomplete="off"
        :placeholder="placeholder"
        class="w-full rounded-xl border-none bg-surface-container-lowest py-3 pl-12 pr-4 font-body text-base text-on-surface shadow-sm placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container dark:bg-dark-surface-container-lowest dark:text-dark-on-surface dark:placeholder:text-dark-outline/60 dark:focus:ring-dark-primary-container"
        @keydown.enter.prevent="dispararPesquisa"
      />
    </div>
    <BaseButton
      v-show="mostrarPesquisar"
      type="button"
      variant="primary"
      size="sm"
      :block="false"
      class="shrink-0 self-stretch sm:self-center"
      @click="dispararPesquisa"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">search</span>
        Pesquisar
      </span>
    </BaseButton>
  </div>
</template>
