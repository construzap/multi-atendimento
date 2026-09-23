<script setup lang="ts">
import BaseButton from '~/components/BaseButton.vue'

const filtroDe = defineModel<string>('filtroDe', { required: true })
const filtroAte = defineModel<string>('filtroAte', { required: true })

defineProps<{
  atualizando?: boolean
  periodoAtivo?: boolean
}>()

const emit = defineEmits<{
  aplicarPeriodo: []
  limparPeriodo: []
  atalho: [preset: 'hoje' | 'ontem' | '7dias' | '30dias']
}>()

const atalhos: { id: 'hoje' | 'ontem' | '7dias' | '30dias'; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: '7dias', label: '7 dias' },
  { id: '30dias', label: '30 dias' },
]
</script>

<template>
  <section
    class="space-y-5 rounded-2xl border border-outline/25 bg-surface-container-lowest p-5 shadow-sm transition-colors dark:border-dark-outline/25 dark:bg-dark-surface-container-lowest md:p-6"
    aria-label="Filtro por período"
  >
    <div class="space-y-1">
      <h2 class="font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
        Período
      </h2>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Filtre por um dia ou intervalo. Os indicadores abaixo atualizam juntos.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="a in atalhos"
        :key="a.id"
        type="button"
        class="rounded-full border border-outline/35 bg-surface px-3.5 py-1.5 text-sm font-medium text-on-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/50 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-outline/35 dark:bg-dark-surface dark:text-dark-on-surface dark:hover:border-primary-400/40 dark:hover:bg-primary-500/15 dark:hover:text-primary-100"
        :disabled="atualizando"
        @click="emit('atalho', a.id)"
      >
        {{ a.label }}
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label
          class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
          for="relatorios-de"
        >
          De
        </label>
        <input
          id="relatorios-de"
          v-model="filtroDe"
          type="date"
          class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition-all duration-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface dark:focus:border-primary-400 dark:focus:ring-primary-400/20"
        />
      </div>
      <div>
        <label
          class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
          for="relatorios-ate"
        >
          Até
        </label>
        <input
          id="relatorios-ate"
          v-model="filtroAte"
          type="date"
          class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition-all duration-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface dark:focus:border-primary-400 dark:focus:ring-primary-400/20"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <BaseButton type="button" :block="false" :disabled="atualizando" @click="emit('aplicarPeriodo')">
        {{ atualizando ? 'Atualizando…' : 'Aplicar período' }}
      </BaseButton>
      <BaseButton
        v-if="periodoAtivo"
        type="button"
        variant="secondary"
        :block="false"
        :disabled="atualizando"
        @click="emit('limparPeriodo')"
      >
        Limpar
      </BaseButton>
    </div>
  </section>
</template>
