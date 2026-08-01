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

const PRECO_BASE = toNumber(config.public.planoInicianteBase, 100)
const PRECO_POR_ITEM = toNumber(config.public.planoIniciantePorProduto, 1)
const PRECO_POR_CANAL = toNumber(config.public.planoIniciantePorCanal, 50)
const MIN_PRODUTOS = 0
const MAX_PRODUTOS = 10_000
const MIN_CANAIS = 1
const MAX_CANAIS = 100
const EXEMPLO_QTD = 50

const modalOpen = ref(false)
const quantidadeProdutos = ref(0)
const quantidadeCanais = ref(MIN_CANAIS)

watch(modalOpen, (aberto) => {
  if (aberto) {
    quantidadeProdutos.value = 0
    quantidadeCanais.value = MIN_CANAIS
  }
})

const canaisAdicionais = computed(() => Math.max(0, quantidadeCanais.value - 1))
const valorProdutos = computed(() => PRECO_POR_ITEM * quantidadeProdutos.value)
const valorCanais = computed(() => PRECO_POR_CANAL * canaisAdicionais.value)
const valorTotal = computed(
  () => PRECO_BASE + valorProdutos.value + valorCanais.value
)

const precoBaseFormatado = formatBRL(PRECO_BASE)
const precoPorItemFormatado = formatBRL(PRECO_POR_ITEM)
const precoPorCanalFormatado = formatBRL(PRECO_POR_CANAL)
const valorTotalFormatado = computed(() => formatBRL(valorTotal.value))

const exemploTotalFormatado = formatBRL(
  PRECO_BASE + PRECO_POR_ITEM * EXEMPLO_QTD
)

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function menosProdutos() {
  quantidadeProdutos.value = clamp(quantidadeProdutos.value - 1, MIN_PRODUTOS, MAX_PRODUTOS)
}

function maisProdutos() {
  quantidadeProdutos.value = clamp(quantidadeProdutos.value + 1, MIN_PRODUTOS, MAX_PRODUTOS)
}

function onInputProdutos(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (raw.trim() === '') {
    quantidadeProdutos.value = MIN_PRODUTOS
    return
  }
  quantidadeProdutos.value = clamp(Number(raw), MIN_PRODUTOS, MAX_PRODUTOS)
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
    class="flex h-full flex-col overflow-hidden rounded-2xl border border-success/40 bg-surface-container-lowest shadow-sm dark:border-dark-success/40 dark:bg-dark-surface-container-low"
  >
    <div class="flex items-center gap-4 px-5 py-5">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success-container/50 text-success-on-container dark:border-dark-success/30 dark:bg-dark-success-container/40 dark:text-dark-on-success-container"
        aria-hidden="true"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">rocket_launch</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-headline text-base font-bold leading-tight text-on-surface dark:text-dark-on-surface">
          Plano Iniciante
        </p>
      </div>
    </div>

    <div class="flex-1 border-t border-outline/30 px-5 py-4 dark:border-dark-outline/30">
      <p class="font-headline text-xl font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
        A partir de R$&nbsp;{{ PRECO_BASE }}
        <span class="font-body text-sm font-normal text-on-surface-variant dark:text-dark-on-surface-variant">
          /mês
        </span>
      </p>
      <p class="mt-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Ideal para começar. O valor final depende da quantidade de produtos e canais.
      </p>
    </div>

    <div class="border-t border-outline/30 px-5 pb-5 pt-4 dark:border-dark-outline/30">
      <BaseButton size="sm" type="button" variant="success" @click="abrirModal">
        Ver plano
      </BaseButton>
    </div>
  </div>

  <BaseModal
    v-model:open="modalOpen"
    title="Plano Iniciante (Dinâmico)"
    panel-class="w-full max-w-md"
  >
    <template #icon>
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">rocket_launch</span>
    </template>

    <div class="space-y-6">
      <div
        class="rounded-xl border border-outline/30 bg-surface-container-high/40 p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/30"
      >
        <p
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Quantidade de produtos
        </p>
        <div class="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="quantidadeProdutos <= MIN_PRODUTOS"
            aria-label="Diminuir produtos"
            @click="menosProdutos"
          >
            −
          </button>
          <input
            :value="quantidadeProdutos"
            type="number"
            inputmode="numeric"
            :min="MIN_PRODUTOS"
            :max="MAX_PRODUTOS"
            aria-label="Quantidade de produtos"
            class="h-11 w-24 rounded-xl border border-outline/50 bg-surface-container-lowest text-center font-headline text-3xl font-bold tabular-nums text-on-surface outline-none transition-colors focus:border-primary-500 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            @input="onInputProdutos"
          >
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="quantidadeProdutos >= MAX_PRODUTOS"
            aria-label="Aumentar produtos"
            @click="maisProdutos"
          >
            +
          </button>
        </div>
      </div>

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
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">Base</dt>
          <dd class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ precoBaseFormatado }}
          </dd>
        </div>
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">
            Produtos ({{ quantidadeProdutos }} × {{ precoPorItemFormatado }})
          </dt>
          <dd class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatBRL(valorProdutos) }}
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
        <div
          class="flex justify-between gap-4 border-t border-outline/30 pt-3 font-body text-sm dark:border-dark-outline/30"
        >
          <dt class="font-semibold text-on-surface dark:text-dark-on-surface">Total mensal</dt>
          <dd class="font-headline font-bold tabular-nums text-success dark:text-dark-success">
            {{ valorTotalFormatado }}
          </dd>
        </div>
      </dl>

      <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        Ex.: {{ EXEMPLO_QTD }} produtos + 1 canal → {{ exemploTotalFormatado }}/mês.
      </p>
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
