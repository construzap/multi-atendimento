<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseButton from '~/components/BaseButton.vue'

/** Um pacote do plano atual no Stripe (valor deve coincidir com o Price). */
const PRECO_PACOTE_REAIS = 200
const CANAIS_POR_PACOTE = 5
const MIN_PACOTES = 1
const MAX_PACOTES = 100

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [pacotes: number]
}>()

const pacotes = ref(1)

watch(
  () => props.open,
  (aberto) => {
    if (aberto) pacotes.value = 1
  }
)

const totalCanais = computed(() => pacotes.value * CANAIS_POR_PACOTE)
const totalReais = computed(() => pacotes.value * PRECO_PACOTE_REAIS)

const totalFormatado = computed(() =>
  totalReais.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
)

function fechar() {
  emit('update:open', false)
}

function menos() {
  if (pacotes.value > MIN_PACOTES) pacotes.value -= 1
}

function mais() {
  if (pacotes.value < MAX_PACOTES) pacotes.value += 1
}

function aoConfirmar() {
  emit('confirm', pacotes.value)
  fechar()
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Escolha os pacotes"
    panel-class="w-full max-w-md"
    @update:open="emit('update:open', $event)"
  >
    <template #subtitle>
      Cada pacote inclui {{ CANAIS_POR_PACOTE }} canais por {{ PRECO_PACOTE_REAIS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}/mês (valor referência).
    </template>

    <template #icon>
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <path d="M4 7h16M4 12h16M4 17h10" stroke-linecap="round" />
      </svg>
    </template>

    <div class="space-y-6">
      <div class="rounded-xl border border-outline/30 bg-surface-container-high/40 p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/30">
        <p class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Quantidade de pacotes
        </p>
        <div class="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="pacotes <= MIN_PACOTES"
            aria-label="Menos um pacote"
            @click="menos"
          >
            −
          </button>
          <span
            class="min-w-[3rem] text-center font-headline text-3xl font-bold tabular-nums text-on-surface dark:text-dark-on-surface"
          >
            {{ pacotes }}
          </span>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/50 bg-surface-container-lowest text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="pacotes >= MAX_PACOTES"
            aria-label="Mais um pacote"
            @click="mais"
          >
            +
          </button>
        </div>
      </div>

      <dl class="space-y-3 rounded-xl border border-outline/30 p-4 dark:border-dark-outline/30">
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">Canais incluídos</dt>
          <dd class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ totalCanais }}
          </dd>
        </div>
        <div class="flex justify-between gap-4 font-body text-sm">
          <dt class="text-on-surface-variant dark:text-dark-on-surface-variant">Total estimado</dt>
          <dd class="font-headline font-bold tabular-nums text-primary-600 dark:text-dark-primary">
            {{ totalFormatado }}
          </dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <BaseButton variant="secondary" type="button" :block="false" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" :block="false" @click="aoConfirmar">
        Continuar para pagamento
      </BaseButton>
    </template>
  </BaseModal>
</template>
