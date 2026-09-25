<script setup lang="ts">
defineProps<{
  tentativas: number
  maximo: number
  esgotou: boolean
  erro?: string
}>()

defineEmits<{
  'verificar-novamente': []
}>()
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-4 pt-16 text-center">
    <template v-if="esgotou">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-600">
        <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" stroke-linecap="round" />
        </svg>
      </div>
      <h2 class="mt-6 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
        Pagamento não encontrado
      </h2>
      <p class="mt-2 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Ainda não identificamos o pagamento. Confira se concluiu no PIX e tente de novo.
      </p>
      <p v-if="erro" class="mt-3 text-sm text-red-600">{{ erro }}</p>
      <button
        type="button"
        class="mt-8 flex h-14 w-full max-w-lg items-center justify-center rounded-full bg-[#00C853] px-5 text-base font-semibold text-white shadow-lg"
        @click="$emit('verificar-novamente')"
      >
        Verificar novamente
      </button>
    </template>

    <template v-else>
      <span
        class="h-12 w-12 animate-spin rounded-full border-[3px] border-outline/30 border-t-[#00C853] dark:border-dark-outline/40"
        aria-hidden="true"
      />
      <h2 class="mt-6 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
        Estamos confirmando seu pagamento
      </h2>
      <p class="mt-2 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Isso pode levar alguns segundos. Não feche esta tela.
      </p>
      <p class="mt-5 text-2xl font-semibold tabular-nums text-[#00C853]">
        {{ tentativas }}/{{ maximo }}
      </p>
      <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Tentativa {{ tentativas }} de {{ maximo }}
      </p>
      <p v-if="erro" class="mt-4 text-sm text-red-600">{{ erro }}</p>
    </template>
  </section>
</template>
