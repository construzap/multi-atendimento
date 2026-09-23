<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LojaLogin } from '#shared/types/loja'

const props = defineProps<{
  inicial?: LojaLogin | null
  pending?: boolean
  erro?: string
}>()

const emit = defineEmits<{
  entrar: [dados: { nome: string; celular: string; cpf: string }]
  cancelar: []
}>()

const nome = ref('')
const celular = ref('')
const cpf = ref('')

watch(
  () => props.inicial,
  (dados) => {
    nome.value = dados?.nome ?? ''
    celular.value = dados?.celular ? mascararCelular(dados.celular) : ''
    cpf.value = dados?.cpf ? mascararCpf(dados.cpf) : ''
  },
  { immediate: true },
)

function soDigitos(valor: string, max: number) {
  let d = valor.replace(/\D/g, '')
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  return d.slice(0, max)
}

function mascararCelular(valor: string) {
  const d = soDigitos(valor, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function mascararCpf(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const podeEntrar = computed(() =>
  Boolean(nome.value.trim())
    && soDigitos(celular.value, 11).length >= 10
    && cpf.value.replace(/\D/g, '').length === 11
    && !props.pending,
)

function entrar() {
  if (!podeEntrar.value) return
  emit('entrar', {
    nome: nome.value.trim(),
    celular: celular.value.trim(),
    cpf: cpf.value.trim(),
  })
}
</script>

<template>
  <form class="flex flex-1 flex-col px-5 pb-6" @submit.prevent="entrar">
    <label class="block text-sm text-on-surface dark:text-dark-on-surface">
      Nome
      <input
        v-model="nome"
        type="text"
        autocomplete="name"
        :disabled="pending"
        class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm text-on-surface outline-none dark:border-dark-outline/35 dark:text-dark-on-surface"
      >
    </label>

    <label class="mt-5 block text-sm text-on-surface dark:text-dark-on-surface">
      Celular
      <span class="mt-2 flex h-12 items-center gap-2 rounded-full border border-outline/35 px-3 dark:border-dark-outline/35">
        <span class="flex shrink-0 items-center gap-1 text-lg" aria-hidden="true">
          <svg class="h-4 w-6 overflow-hidden rounded-[2px]" viewBox="0 0 22 16">
            <rect width="22" height="16" fill="#009B3A" />
            <path d="M11 2.2 19.4 8 11 13.8 2.6 8Z" fill="#FEDF00" />
            <circle cx="11" cy="8" r="3.1" fill="#002776" />
          </svg>
          <svg class="h-3 w-3 text-on-surface-variant dark:text-dark-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <input
          :value="celular"
          type="tel"
          inputmode="numeric"
          autocomplete="tel"
          :disabled="pending"
          class="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none dark:text-dark-on-surface"
          @input="celular = mascararCelular(($event.target as HTMLInputElement).value)"
        >
      </span>
    </label>

    <label class="mt-5 block text-sm text-on-surface dark:text-dark-on-surface">
      CPF
      <input
        :value="cpf"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :disabled="pending"
        class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm text-on-surface outline-none dark:border-dark-outline/35 dark:text-dark-on-surface"
        @input="cpf = mascararCpf(($event.target as HTMLInputElement).value)"
      >
    </label>

    <p v-if="erro" class="mt-4 text-center text-sm text-red-500">{{ erro }}</p>

    <div class="mt-8 flex flex-col gap-2">
      <button
        type="submit"
        class="flex h-12 items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
        :disabled="!podeEntrar"
      >
        {{ pending ? 'Entrando…' : 'Entrar' }}
      </button>
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full border border-outline/30 text-sm font-medium text-on-surface dark:border-dark-outline/30 dark:text-dark-on-surface"
        :disabled="pending"
        @click="emit('cancelar')"
      >
        Cancelar
      </button>
    </div>
  </form>
</template>
