<script setup lang="ts">
const porcentagemMulta = defineModel<string>('porcentagemMulta', { required: true })
const porcentagemJurosMes = defineModel<string>('porcentagemJurosMes', { required: true })

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest py-2.5 pl-10 pr-3 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 4
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        Regras de atraso
      </h2>
      <p class="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
        Configure multa e juros que poderão ser aplicados quando o cliente pagar depois do vencimento.
      </p>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Multa por atraso
        </label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            %
          </span>
          <input v-model="porcentagemMulta" type="text" :class="inputClass">
        </div>
        <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Aplicada uma vez após o vencimento.
        </p>
      </div>

      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Juros ao mês
        </label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            %
          </span>
          <input v-model="porcentagemJurosMes" type="text" :class="inputClass">
        </div>
        <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Calculado proporcionalmente aos dias de atraso.
        </p>
      </div>
    </div>

    <div class="rounded-2xl border border-outline/30 bg-surface-container-low p-5 dark:border-dark-outline/30 dark:bg-dark-surface-container">
      <p class="font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Exemplo mockado
      </p>
      <p class="mt-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Se o cliente atrasar, a cobrança poderá receber multa de {{ porcentagemMulta }}% e juros de {{ porcentagemJurosMes }}% ao mês.
      </p>
    </div>
  </section>
</template>
