<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LojaCepLookup } from '#shared/types/loja'
import { cepCompleto, formatarCep, normalizarCep } from '#shared/utils/lojaCep'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const emit = defineEmits<{
  salvo: []
  iniciar: []
}>()

const loja = useLojaWorkspaceStore()

const cep = ref('')
const rua = ref('')
const numero = ref('')
const complemento = ref('')
const bairro = ref('')
const cidade = ref('')
const estado = ref('')
const pontoReferencia = ref('')
const apelido = ref('')
const padrao = ref(false)
const lat = ref<number | null>(null)
const lon = ref<number | null>(null)

const buscandoCep = ref(false)
const salvando = ref(false)
const erro = ref('')
const ultimoCepBuscado = ref('')

const inputClass =
  'mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm outline-none placeholder:text-on-surface-variant dark:border-dark-outline/35 dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant'

function aplicarCep(valor: LojaCepLookup) {
  cep.value = valor.cep
  if (valor.rua) rua.value = valor.rua
  if (valor.bairro) bairro.value = valor.bairro
  if (valor.cidade) cidade.value = valor.cidade
  if (valor.estado) estado.value = valor.estado
  if (valor.complemento && !complemento.value.trim()) complemento.value = valor.complemento
  lat.value = valor.lat
  lon.value = valor.lon
}

async function buscarCep(forcar = false) {
  const digits = normalizarCep(cep.value)
  if (!cepCompleto(digits) || buscandoCep.value || salvando.value) return
  if (!forcar && digits === ultimoCepBuscado.value) return

  buscandoCep.value = true
  erro.value = ''
  try {
    const res = await $fetch<{ ok: true; data: LojaCepLookup }>(
      '/api/public/loja/geocode/cep',
      { query: { cep: digits } },
    )
    ultimoCepBuscado.value = digits
    aplicarCep(res.data)
  } catch (err) {
    ultimoCepBuscado.value = digits
    const status = (err as { statusCode?: number })?.statusCode
    erro.value = status === 404
      ? 'CEP não encontrado. Confira ou preencha o endereço abaixo.'
      : 'Não foi possível consultar este CEP. Preencha o endereço abaixo.'
  } finally {
    buscandoCep.value = false
  }
}

function aoDigitarCep(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  cep.value = formatarCep(alvo.value)
  emit('iniciar')
}

watch(cep, (valor) => {
  if (cepCompleto(valor)) void buscarCep()
})

function campo(v: string) {
  return v.trim()
}

async function salvar() {
  if (salvando.value || buscandoCep.value) return

  const payload = {
    cep: formatarCep(cep.value),
    rua: campo(rua.value),
    numero: campo(numero.value),
    complemento: campo(complemento.value) || null,
    bairro: campo(bairro.value),
    cidade: campo(cidade.value),
    uf: campo(estado.value).toUpperCase(),
    ponto_referencia: campo(pontoReferencia.value) || null,
    apelido: campo(apelido.value) || null,
    padrao: padrao.value,
    lat: lat.value,
    lon: lon.value,
  }

  if (!cepCompleto(payload.cep)) {
    erro.value = 'Informe um CEP válido.'
    return
  }
  if (!payload.rua) {
    erro.value = 'Informe a rua.'
    return
  }
  if (!payload.numero) {
    erro.value = 'Informe o número.'
    return
  }
  if (!payload.bairro) {
    erro.value = 'Informe o bairro.'
    return
  }
  if (!payload.cidade) {
    erro.value = 'Informe a cidade.'
    return
  }
  if (!payload.uf) {
    erro.value = 'Informe o estado.'
    return
  }

  salvando.value = true
  erro.value = ''
  try {
    await loja.adicionarEndereco(payload)
    emit('salvo')
  } catch {
    erro.value = 'Não foi possível salvar o endereço.'
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <label class="block text-sm text-on-surface dark:text-dark-on-surface">
      CEP
      <input
        :value="cep"
        type="text"
        inputmode="numeric"
        maxlength="9"
        autocomplete="postal-code"
        placeholder="00000-000"
        :class="inputClass"
        :disabled="buscandoCep || salvando"
        @input="aoDigitarCep"
        @blur="buscarCep()"
      >
    </label>
    <p v-if="buscandoCep" class="mt-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Buscando CEP…
    </p>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Rua
      <input v-model="rua" type="text" placeholder="Rua, avenida…" :class="inputClass" :disabled="salvando">
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Número
      <input
        v-model="numero"
        type="text"
        inputmode="numeric"
        placeholder="Ex: 123"
        :class="inputClass"
        :disabled="salvando"
      >
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Complemento
      <input v-model="complemento" type="text" placeholder="Apto, bloco…" :class="inputClass" :disabled="salvando">
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Bairro
      <input v-model="bairro" type="text" :class="inputClass" :disabled="salvando">
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Cidade
      <input v-model="cidade" type="text" :class="inputClass" :disabled="salvando">
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Estado
      <input
        v-model="estado"
        type="text"
        maxlength="2"
        placeholder="UF"
        class="mt-2 h-12 w-full rounded-full border border-outline/35 bg-transparent px-4 text-sm uppercase outline-none placeholder:text-on-surface-variant dark:border-dark-outline/35 dark:text-dark-on-surface"
        :disabled="salvando"
      >
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Ponto de referência
      <input v-model="pontoReferencia" type="text" :class="inputClass" :disabled="salvando">
    </label>

    <label class="mt-4 block text-sm text-on-surface dark:text-dark-on-surface">
      Favoritar endereço
      <input
        v-model="apelido"
        type="text"
        placeholder="Ex: Casa, Trabalho"
        :class="inputClass"
        :disabled="salvando"
      >
    </label>

    <label class="mt-4 flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface">
      <input v-model="padrao" type="checkbox" class="h-4 w-4 accent-[#00C853]" :disabled="salvando">
      Definir como endereço padrão
    </label>

    <p v-if="erro" class="mt-4 text-center text-sm text-red-500">{{ erro }}</p>

    <button
      type="button"
      class="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
      :disabled="salvando || buscandoCep"
      @click="salvar"
    >
      {{ salvando ? 'Salvando…' : 'Salvar endereço' }}
    </button>
  </div>
</template>
