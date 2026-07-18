<script setup lang="ts">
const props = defineProps<{
  nome: string
  unidadeVenda: string
  quantidade: number
  precoUnitario: string
  subtotal: string
}>()

const emit = defineEmits<{
  'update:quantidade': [value: number]
  'update:precoUnitario': [value: string]
  remover: []
}>()

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'

function atualizarQuantidade(value: string) {
  const numero = Number.parseInt(value, 10)
  emit('update:quantidade', Number.isFinite(numero) && numero > 0 ? numero : 1)
}
</script>

<template>
  <div
    class="grid gap-3 rounded-xl border border-outline/30 bg-surface-container-lowest p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-low md:grid-cols-[1fr_88px_96px_140px_120px_44px] md:items-end"
  >
    <div class="space-y-1.5">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Produto
      </label>
      <div
        class="rounded-lg border border-outline/30 bg-surface-container-low px-3 py-2.5 font-body text-sm text-on-surface dark:border-dark-outline/30 dark:bg-dark-surface-container dark:text-dark-on-surface"
      >
        {{ props.nome }}
      </div>
    </div>

    <div class="space-y-1.5">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Unidade
      </label>
      <div
        class="rounded-lg border border-outline/30 bg-surface-container-low px-3 py-2.5 font-body text-sm text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container dark:text-dark-on-surface-variant"
      >
        {{ props.unidadeVenda || 'un' }}
      </div>
    </div>

    <div class="space-y-1.5">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Qtd.
      </label>
      <input
        :value="props.quantidade"
        type="number"
        min="1"
        :class="inputClass"
        @input="atualizarQuantidade(($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="space-y-1.5">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Preço à vista
      </label>
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          R$
        </span>
        <input
          :value="props.precoUnitario"
          type="text"
          :class="[inputClass, 'pl-10']"
          @input="emit('update:precoUnitario', ($event.target as HTMLInputElement).value)"
        >
      </div>
    </div>

    <div class="space-y-1.5">
      <span class="block font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Subtotal
      </span>
      <div
        class="rounded-lg border border-outline/30 bg-surface-container-low px-3 py-2.5 font-label text-sm font-semibold text-primary dark:border-dark-outline/30 dark:bg-dark-surface-container dark:text-dark-primary"
      >
        {{ subtotal }}
      </div>
    </div>

    <button
      type="button"
      class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-outline/40 text-on-surface-variant transition hover:bg-surface-container-high hover:text-danger dark:border-dark-outline/40 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-danger"
      aria-label="Remover produto"
      @click="emit('remover')"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>
