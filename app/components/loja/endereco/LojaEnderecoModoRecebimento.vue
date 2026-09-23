<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { modoRecebimento } = storeToRefs(loja)
</script>

<template>
  <section class="px-4 pt-6">
    <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Como deseja receber seu pedido?
    </p>
    <div class="grid grid-cols-2 gap-3">
      <button
        type="button"
        class="flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium"
        :class="
          modoRecebimento === 'entrega'
            ? 'border-[#00C853] text-on-surface dark:text-dark-on-surface'
            : 'border-outline/25 text-on-surface-variant dark:border-dark-outline/25 dark:text-dark-on-surface-variant'
        "
        @click="loja.setModoRecebimento('entrega')"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M3 7h11v10H3z" stroke-linejoin="round" />
          <path d="M14 10h4l3 3v4h-7" stroke-linejoin="round" />
          <circle cx="7" cy="17" r="1.4" />
          <circle cx="18" cy="17" r="1.4" />
        </svg>
        Entrega
      </button>
      <button
        type="button"
        class="flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium"
        :class="
          modoRecebimento === 'retirada'
            ? 'border-[#00C853] text-on-surface dark:text-dark-on-surface'
            : 'border-outline/25 text-on-surface-variant dark:border-dark-outline/25 dark:text-dark-on-surface-variant'
        "
        @click="loja.setModoRecebimento('retirada')"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M6 8h12l-1 12H7L6 8z" stroke-linejoin="round" />
          <path d="M9 8V7a3 3 0 016 0v1" stroke-linecap="round" />
        </svg>
        Retirada
      </button>
    </div>
  </section>
</template>
