<script setup lang="ts">
import { onMounted } from 'vue'
import type { FrequenciaCobranca, FrequenciaRecorrencia, TipoCobranca } from '#shared/types/cobranca'
import { OPCOES_FUSO_BRASIL } from '#shared/constants/ianaTimezonesBrasil'

const tipoCobranca = defineModel<TipoCobranca>('tipoCobranca', { required: true })
const dataProximaLocal = defineModel<string>('dataProximaLocal', { required: true })
const horaProximaLocal = defineModel<string>('horaProximaLocal', { required: true })
const ianaTimezone = defineModel<string>('ianaTimezone', { required: true })
const totalParcelas = defineModel<number>('totalParcelas', { required: true })
const frequenciaRecorrencia = defineModel<FrequenciaRecorrencia>('frequenciaRecorrencia', { required: true })
const frequenciaCobranca = defineModel<FrequenciaCobranca>('frequenciaCobranca', { required: true })
const dataFim = defineModel<string>('dataFim', { required: true })

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20 dark:[color-scheme:dark]'

const opcoesTipo = [
  { value: 'unico', label: 'Fiado', description: 'Uma cobrança avulsa para pagar no vencimento.', oculto: false },
  { value: 'parcelado', label: 'Parcelado', description: 'Divide a compra em várias parcelas.', oculto: true },
  { value: 'assinatura', label: 'Assinatura', description: 'Recorrência semanal ou mensal.', oculto: true },
] as const

const opcoesVisiveis = opcoesTipo.filter((opcao) => !opcao.oculto)

const opcoesFrequenciaCobranca: { value: FrequenciaCobranca; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

const opcoesFusoBrasil = OPCOES_FUSO_BRASIL

onMounted(() => {
  tipoCobranca.value = 'unico'
})
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 3
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        Como será pago?
      </h2>
      <p class="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
        Defina data, horário, fuso e a frequência se o cliente não pagar.
      </p>
    </header>

    <div class="grid max-w-md gap-3 md:grid-cols-1">
      <button
        v-for="opcao in opcoesVisiveis"
        :key="opcao.value"
        type="button"
        class="rounded-2xl border p-4 text-left transition"
        :class="tipoCobranca === opcao.value
          ? 'border-primary bg-primary-50/70 dark:border-dark-primary dark:bg-dark-primary-container/30'
          : 'border-outline/30 bg-surface-container-lowest hover:border-outline dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:hover:border-dark-outline'"
        @click="tipoCobranca = opcao.value"
      >
        <span class="font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          {{ opcao.label }}
        </span>
        <span class="mt-1 block font-body text-xs leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ opcao.description }}
        </span>
      </button>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Data da próxima notificação
        </label>
        <input v-model="dataProximaLocal" type="date" :class="inputClass">
      </div>

      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Horário
        </label>
        <input v-model="horaProximaLocal" type="time" :class="inputClass">
      </div>

      <div class="space-y-1.5 md:col-span-2">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Fuso horário da notificação
        </label>
        <p class="font-body text-xs leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
          A data e a hora acima são interpretadas neste fuso (lista Brasil).
        </p>
        <select v-model="ianaTimezone" :class="inputClass">
          <option v-for="op in opcoesFusoBrasil" :key="op.value" :value="op.value">
            {{ op.label }}
          </option>
        </select>
      </div>

      <div
        v-if="tipoCobranca === 'unico'"
        class="space-y-1.5 md:col-span-2"
      >
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Se ele não pagar, como vai ser feita a cobrança?
        </label>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            v-for="opcao in opcoesFrequenciaCobranca"
            :key="opcao.value"
            type="button"
            class="rounded-xl border px-3 py-2.5 text-center font-label text-sm font-semibold transition"
            :class="frequenciaCobranca === opcao.value
              ? 'border-primary bg-primary-50/70 text-primary-700 dark:border-dark-primary dark:bg-dark-primary-container/30 dark:text-dark-primary'
              : 'border-outline/30 bg-surface-container-lowest text-on-surface hover:border-outline dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:border-dark-outline'"
            @click="frequenciaCobranca = opcao.value"
          >
            {{ opcao.label }}
          </button>
        </div>
      </div>

      <div v-if="tipoCobranca === 'parcelado'" class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Quantidade de parcelas
        </label>
        <input v-model.number="totalParcelas" type="number" min="2" :class="inputClass">
      </div>

      <template v-if="tipoCobranca === 'assinatura'">
        <div class="space-y-1.5">
          <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
            Frequência
          </label>
          <select v-model="frequenciaRecorrencia" :class="inputClass">
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
            Data de término (opcional)
          </label>
          <input v-model="dataFim" type="date" :class="inputClass">
        </div>
      </template>
    </div>
  </section>
</template>
