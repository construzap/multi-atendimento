<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EntregaPublicaResumo, EntregaPublicaResumoResponse } from '#shared/types/entrega'

definePageMeta({
  layout: false,
})

const route = useRoute()
const token = computed(() => String(route.params.token ?? '').trim())

const loading = ref(true)
const submitting = ref(false)
const erro = ref('')
const resumo = ref<EntregaPublicaResumo | null>(null)

const codigoEntregador = ref('')
const codigoConfirmacao = ref('')

const CODIGO_CONFIRM_MAX = 64

const codigoConfirmacaoNormalizado = computed(() =>
  String(codigoConfirmacao.value ?? '').trim().slice(0, CODIGO_CONFIRM_MAX),
)

const podeConfirmarEntrega = computed(
  () => !submitting.value && codigoConfirmacaoNormalizado.value.length >= 1,
)

function onCodigoConfirmacaoInput(event: Event) {
  const el = event.target as HTMLInputElement | null
  const raw = String(el?.value ?? '').slice(0, CODIGO_CONFIRM_MAX)
  codigoConfirmacao.value = raw
}

const step = computed(() => {
  const r = resumo.value
  if (!r) return 0
  if (r.entrega_status === 'entregue') return 5
  if (!r.entregador_identificado) return 1
  if (r.entrega_status === 'aguardando_entregador') return 2
  if (r.entrega_status === 'coletado') return 3
  if (r.entrega_status === 'no_local') return 4
  return 1
})

function mensagemErro(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback
  const e = err as Record<string, unknown>
  const data = e.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.message === 'string' && d.message.trim()) return d.message
    if (typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
  }
  if (typeof e.statusMessage === 'string' && e.statusMessage.trim()) return e.statusMessage
  if (typeof e.message === 'string' && e.message.trim()) return e.message
  return fallback
}

async function carregar() {
  loading.value = true
  erro.value = ''
  try {
    const res = await $fetch<EntregaPublicaResumoResponse>(`/api/public/entrega/${token.value}`)
    resumo.value = res.data
  } catch (err) {
    resumo.value = null
    erro.value = mensagemErro(err, 'Não foi possível carregar este pedido de entrega.')
  } finally {
    loading.value = false
  }
}

async function identificar() {
  if (submitting.value) return
  submitting.value = true
  erro.value = ''
  try {
    const res = await $fetch<EntregaPublicaResumoResponse>(
      `/api/public/entrega/${token.value}/identificar`,
      {
        method: 'POST',
        body: { codigo: codigoEntregador.value },
      },
    )
    resumo.value = res.data
    codigoEntregador.value = ''
  } catch (err) {
    erro.value = mensagemErro(err, 'Código de entregador inválido.')
  } finally {
    submitting.value = false
  }
}

async function avancarStatus(acao: 'coletado' | 'no_local') {
  if (submitting.value) return
  submitting.value = true
  erro.value = ''
  try {
    const res = await $fetch<EntregaPublicaResumoResponse>(
      `/api/public/entrega/${token.value}/status`,
      {
        method: 'POST',
        body: { acao },
      },
    )
    resumo.value = res.data
  } catch (err) {
    erro.value = mensagemErro(err, 'Não foi possível atualizar o status.')
  } finally {
    submitting.value = false
  }
}

async function confirmarEntrega() {
  if (!podeConfirmarEntrega.value) return
  submitting.value = true
  erro.value = ''
  try {
    const res = await $fetch<EntregaPublicaResumoResponse>(
      `/api/public/entrega/${token.value}/entregar`,
      {
        method: 'POST',
        body: { codigo_confirmacao: codigoConfirmacaoNormalizado.value },
      },
    )
    resumo.value = res.data
    codigoConfirmacao.value = ''
  } catch (err) {
    erro.value = mensagemErro(err, 'Não foi possível confirmar a entrega.')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
    <div class="mx-auto w-full max-w-md">
      <header class="mb-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Entrega
        </p>
        <h1 class="mt-1 text-2xl font-bold">
          {{ resumo?.loja_nome || 'Pedido' }}
        </h1>
        <p v-if="resumo" class="mt-1 text-sm text-slate-600">
          Pedido {{ resumo.pedido_label }}
        </p>
      </header>

      <div
        v-if="loading"
        class="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm"
      >
        Carregando…
      </div>

      <div
        v-else-if="!resumo"
        class="rounded-2xl bg-white p-6 shadow-sm"
      >
        <p class="text-sm text-red-600">{{ erro || 'Pedido não encontrado.' }}</p>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <dl class="space-y-2 text-sm">
            <div v-if="resumo.cliente_nome" class="flex justify-between gap-3">
              <dt class="text-slate-500">Cliente</dt>
              <dd class="font-medium text-right">{{ resumo.cliente_nome }}</dd>
            </div>
            <div v-if="resumo.endereco" class="flex justify-between gap-3">
              <dt class="text-slate-500">Endereço</dt>
              <dd class="font-medium text-right">{{ resumo.endereco }}</dd>
            </div>
            <div v-if="resumo.entregador_nome" class="flex justify-between gap-3">
              <dt class="text-slate-500">Entregador</dt>
              <dd class="font-medium text-right">{{ resumo.entregador_nome }}</dd>
            </div>
          </dl>
        </div>

        <p
          v-if="erro"
          class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ erro }}
        </p>

        <!-- Step 5: concluído -->
        <div
          v-if="step === 5"
          class="rounded-2xl bg-emerald-50 p-6 text-center shadow-sm"
        >
          <p class="text-lg font-bold text-emerald-800">Entrega concluída</p>
          <p class="mt-2 text-sm text-emerald-700">
            O pedido foi marcado como entregue com sucesso.
          </p>
        </div>

        <!-- Step 1: código entregador -->
        <form
          v-else-if="step === 1"
          class="rounded-2xl bg-white p-5 shadow-sm space-y-4"
          @submit.prevent="identificar"
        >
          <div>
            <h2 class="text-base font-semibold">Identificação</h2>
            <p class="mt-1 text-sm text-slate-500">
              Digite o seu código de entregador para começar.
            </p>
          </div>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium">Código do entregador</span>
            <input
              v-model="codigoEntregador"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              placeholder="Ex: ENT-042"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-slate-400"
              :disabled="submitting"
            />
          </label>
          <button
            type="submit"
            class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="submitting || !codigoEntregador.trim()"
          >
            {{ submitting ? 'Validando…' : 'Continuar' }}
          </button>
        </form>

        <!-- Step 2: coletou -->
        <div
          v-else-if="step === 2"
          class="rounded-2xl bg-white p-5 shadow-sm space-y-4"
        >
          <div>
            <h2 class="text-base font-semibold">Coleta</h2>
            <p class="mt-1 text-sm text-slate-500">
              Confirme quando retirar o pedido na loja.
            </p>
          </div>
          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="submitting"
            @click="avancarStatus('coletado')"
          >
            {{ submitting ? 'Salvando…' : 'Coletei o produto' }}
          </button>
        </div>

        <!-- Step 3: chegou -->
        <div
          v-else-if="step === 3"
          class="rounded-2xl bg-white p-5 shadow-sm space-y-4"
        >
          <div>
            <h2 class="text-base font-semibold">Chegada</h2>
            <p class="mt-1 text-sm text-slate-500">
              Confirme quando chegar no endereço de entrega.
            </p>
          </div>
          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="submitting"
            @click="avancarStatus('no_local')"
          >
            {{ submitting ? 'Salvando…' : 'Cheguei no local' }}
          </button>
        </div>

        <!-- Step 4: código cliente -->
        <form
          v-else-if="step === 4"
          class="rounded-2xl bg-white p-5 shadow-sm space-y-4"
          @submit.prevent="confirmarEntrega"
        >
          <div>
            <h2 class="text-base font-semibold">Confirmar entrega</h2>
            <p class="mt-1 text-sm text-slate-500">
              Peça ao cliente o código de confirmação e digite abaixo.
            </p>
          </div>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium">Código do cliente</span>
            <input
              :value="codigoConfirmacao"
              type="text"
              autocomplete="one-time-code"
              placeholder="Código do pedido"
              maxlength="64"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl font-semibold tracking-wide outline-none focus:border-slate-400"
              :disabled="submitting"
              @input="onCodigoConfirmacaoInput"
            />
          </label>
          <button
            type="submit"
            class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="!podeConfirmarEntrega"
          >
            {{ submitting ? 'Confirmando…' : 'Confirmar entrega' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
