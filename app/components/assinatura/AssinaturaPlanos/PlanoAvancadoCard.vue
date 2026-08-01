<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseButton from '~/components/BaseButton.vue'

const config = useRuntimeConfig()

function toNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PRECO_MENSAL = toNumber(config.public.planoAvancado, 600)
const PRECO_POR_CANAL = toNumber(config.public.planoAvancadoPorCanal, 50)
const MIN_CANAIS = 1
const MAX_CANAIS = 100

const modalOpen = ref(false)
const quantidadeCanais = ref(MIN_CANAIS)

watch(modalOpen, (aberto) => {
  if (aberto) quantidadeCanais.value = MIN_CANAIS
})

const canaisAdicionais = computed(() => Math.max(0, quantidadeCanais.value - 1))
const valorCanais = computed(() => PRECO_POR_CANAL * canaisAdicionais.value)
const valorTotal = computed(() => PRECO_MENSAL + valorCanais.value)

const precoFormatado = formatBRL(PRECO_MENSAL)
const precoPorCanalFormatado = formatBRL(PRECO_POR_CANAL)
const valorTotalFormatado = computed(() => formatBRL(valorTotal.value))

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function menosCanais() {
  quantidadeCanais.value = clamp(quantidadeCanais.value - 1, MIN_CANAIS, MAX_CANAIS)
}

function maisCanais() {
  quantidadeCanais.value = clamp(quantidadeCanais.value + 1, MIN_CANAIS, MAX_CANAIS)
}

function onInputCanais(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (raw.trim() === '') {
    quantidadeCanais.value = MIN_CANAIS
    return
  }
  quantidadeCanais.value = clamp(Number(raw), MIN_CANAIS, MAX_CANAIS)
}

function abrirModal() {
  modalOpen.value = true
}

function fecharModal() {
  modalOpen.value = false
}

function adicionar() {
  // Sem chamada de API por enquanto
  fecharModal()
}
</script>

<template>
  <div
    class="flex h-full flex-col overflow-hidden rounded-2xl border border-danger/40 bg-surface-container-lowest shadow-sm dark:border-dark-danger/40 dark:bg-dark-surface-container-low"
  >
    <div class="flex items-center gap-4 px-5 py-5">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger-container/50 text-danger-on-container dark:border-dark-danger/30 dark:bg-dark-danger-container/40 dark:text-dark-on-danger-container"
        aria-hidden="true"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">workspace_premium</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-headline text-base font-bold leading-tight text-on-surface dark:text-dark-on-surface">
          Plano Avançado
        </p>
      </div>
    </div>

    <div class="flex-1 border-t border-outline/30 px-5 py-4 dark:border-dark-outline/30">
      <p class="font-headline text-xl font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
        A partir de {{ precoFormatado }}
        <span class="font-body text-sm font-normal text-on-surface-variant dark:text-dark-on-surface-variant">
          /mês
        </span>
      </p>
      <p class="mt-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Valor mensal + canais. Produtos ilimitados.
      </p>
    </div>

    <div class="border-t border-outline/30 px-5 pb-5 pt-4 dark:border-dark-outline/30">
      <BaseButton size="sm" type="button" variant="secondary" @click="abrirModal">
        Ver plano
      </BaseButton>
    </div>
  </div>

  <BaseModal
    v-model:open="modalOpen"
    title="Plano Avançado"
    panel-class="w-full max-w-md"
  >
    <template #subtitle>
      Plano fixo + valor por canal.
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">workspace_premium</span>
    </template>

    <div class="space-y-6">
      <div
        class="rounded-xl border border-outline/30 bg-surface-container-high/40 p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/30"
      >
        <p
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Quantidade de canais
        </p>
        <div class="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="quantidadeCanais <= MIN_CANAIS"
            aria-label="Diminuir canais"
            @click="menosCanais"
          >
            −
          </button>
          <input
            :value="quantidadeCanais"
            type="number"
            inputmode="numeric"
            :min="MIN_CANAIS"
            :max="MAX_CANAIS"
            aria-label="Quantidade de canais"
            class="h-11 w-24 rounded-xl border border-outline/50 bg-surface-container-lowest text-center font-headline text-3xl font-bold tabular-nums text-on-surface outline-none transition-colors focus:border-primary-500 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            @input="onInputCanais"
          >
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="quantidadeCanais >= MAX_CANAIS"
            aria-label="Aumentar canais"
            @click="maisCanais"
          >
            +
          </button>
        </div>
      </div>

      <dl class="space-y-3 rounded-xl border border-outline/30 p-4 dark:border-dark-outline/30">
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">Valor do plano</dt>
          <dd class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ precoFormatado }}
          </dd>
        </div>
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">
            Canais adicionais ({{ canaisAdicionais }} × {{ precoPorCanalFormatado }})
          </dt>
          <dd class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatBRL(valorCanais) }}
          </dd>
        </div>
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">Limite de produtos</dt>
          <dd class="font-semibold text-on-surface dark:text-dark-on-surface">
            Sem limite
          </dd>
        </div>
        <div
          class="flex justify-between gap-4 border-t border-outline/30 pt-3 font-body text-sm dark:border-dark-outline/30"
        >
          <dt class="font-semibold text-on-surface dark:text-dark-on-surface">Total mensal</dt>
          <dd class="font-headline font-bold tabular-nums text-danger dark:text-dark-danger">
            {{ valorTotalFormatado }}
          </dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <BaseButton variant="secondary" type="button" :block="false" @click="fecharModal">
        Fechar
      </BaseButton>
      <BaseButton type="button" :block="false" @click="adicionar">
        Adicionar
      </BaseButton>
    </template>
  </BaseModal>
</template>
