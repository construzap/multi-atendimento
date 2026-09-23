<script setup lang="ts">
import type { LojaLogin } from '#shared/types/loja'

defineProps<{
  candidato: LojaLogin
  pending?: boolean
}>()

defineEmits<{
  confirmar: []
  recusar: []
}>()

function mascararCelular(valor: string) {
  const d = valor.replace(/\D/g, '')
  const local = d.startsWith('55') ? d.slice(2) : d
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return valor
}
</script>

<template>
  <div class="flex flex-1 flex-col px-5 pb-6">
    <p class="text-sm leading-relaxed text-on-surface dark:text-dark-on-surface">
      Encontramos esse número em nosso banco de dados. Confirme se é você.
    </p>

    <div class="mt-5 rounded-2xl bg-primary-50 px-4 py-3 dark:bg-dark-surface-container">
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        {{ candidato.nome || 'Sem nome' }}
      </p>
      <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ mascararCelular(candidato.celular) }}
      </p>
    </div>

    <div class="mt-8 flex flex-col gap-2">
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
        :disabled="pending"
        @click="$emit('confirmar')"
      >
        Sim, sou eu
      </button>
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full border border-outline/30 text-sm font-medium text-on-surface dark:border-dark-outline/30 dark:text-dark-on-surface"
        :disabled="pending"
        @click="$emit('recusar')"
      >
        Não, digitar novamente
      </button>
    </div>
  </div>
</template>
