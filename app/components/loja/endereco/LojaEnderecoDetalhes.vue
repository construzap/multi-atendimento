<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LojaEndereco, LojaGeocodeReverso } from '#shared/types/loja'
import { resumoEndereco } from '~/components/loja/endereco/enderecosMock'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  geo: LojaGeocodeReverso
  inicial?: LojaEndereco | null
}>()

const emit = defineEmits<{
  voltar: []
  fechar: []
  salvo: []
}>()

const loja = useLojaWorkspaceStore()
const resumo = computed(() => resumoEndereco(props.geo))

const numero = ref(props.inicial?.numero || props.geo.numero || '')
const complemento = ref(props.inicial?.complemento || '')
const pontoReferencia = ref(props.inicial?.ponto_referencia || '')
const apelido = ref(props.inicial?.apelido || '')
const padrao = ref(props.inicial?.padrao === true)

const salvando = ref(false)
const erroSalvar = ref('')

async function salvar() {
  if (salvando.value) return
  const numeroTrim = numero.value.trim()
  if (!numeroTrim) {
    erroSalvar.value = 'Informe o número.'
    return
  }
  salvando.value = true
  erroSalvar.value = ''
  try {
    const payload = {
      rua: props.geo.rua,
      numero: numeroTrim,
      complemento: complemento.value.trim() || null,
      bairro: props.geo.bairro,
      cidade: props.geo.cidade,
      uf: props.geo.estado,
      cep: props.geo.cep,
      ponto_referencia: pontoReferencia.value.trim() || null,
      apelido: apelido.value.trim() || null,
      padrao: padrao.value,
      lat: props.geo.lat,
      lon: props.geo.lon,
    }
    if (props.inicial?.id != null) {
      await loja.atualizarEndereco(props.inicial.id, payload)
    } else {
      await loja.adicionarEndereco(payload)
    }
    emit('salvo')
  } catch {
    erroSalvar.value = 'Não foi possível salvar o endereço.'
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-center justify-between px-5 py-3">
      <h2 class="text-lg font-semibold text-on-surface dark:text-dark-on-surface">
        Detalhes do endereço
      </h2>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center text-on-surface dark:text-dark-on-surface"
        aria-label="Fechar"
        @click="emit('fechar')"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
      <div class="rounded-2xl bg-primary-50 px-4 py-3 text-center dark:bg-dark-surface-container">
        <p class="text-sm font-semibold leading-snug text-on-surface dark:text-dark-on-surface">
          {{ resumo.titulo }}
        </p>
        <p v-if="resumo.subtitulo" class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ resumo.subtitulo }}
        </p>
      </div>

      <label class="mt-5 block text-sm text-on-surface dark:text-dark-on-surface">
        Número
        <input
          v-model="numero"
          type="text"
          inputmode="numeric"
          placeholder="Ex: 123"
          class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm outline-none placeholder:text-on-surface-variant dark:border-dark-outline/35"
        >
      </label>

      <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
        Complemento
        <input
          v-model="complemento"
          type="text"
          class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm outline-none dark:border-dark-outline/35"
        >
      </label>

      <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
        Ponto de referência
        <input
          v-model="pontoReferencia"
          type="text"
          class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm outline-none dark:border-dark-outline/35"
        >
      </label>

      <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
        Favoritar endereço
        <input
          v-model="apelido"
          type="text"
          placeholder="Ex: Casa, Trabalho"
          class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm outline-none placeholder:text-on-surface-variant dark:border-dark-outline/35"
        >
      </label>

      <label class="mt-4 flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface">
        <input v-model="padrao" type="checkbox" class="h-4 w-4 accent-[#00C853]">
        Definir como endereço padrão
      </label>
    </div>

    <p v-if="erroSalvar" class="px-5 text-center text-sm text-red-500">{{ erroSalvar }}</p>

    <div class="flex flex-col gap-2 px-5 py-4">
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
        :disabled="salvando || !numero.trim()"
        @click="salvar"
      >
        {{ salvando ? 'Salvando…' : 'Salvar endereço' }}
      </button>
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full border border-outline/30 text-sm font-medium text-on-surface dark:border-dark-outline/30 dark:text-dark-on-surface"
        @click="emit('voltar')"
      >
        Voltar
      </button>
    </div>
  </div>
</template>
