<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EntregaPublicaResumo, EntregaPublicaResumoResponse } from '#shared/types/entrega'
import { parseCoordenadasValidas } from '#shared/utils/navegacaoMapas'
import EntregaNavegacaoMapas from '~/components/entregadores/EntregaNavegacaoMapas.vue'
import { useEntregaColetaStore } from '~/stores/entregaColeta'

definePageMeta({
  layout: false,
})

useHead({
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover',
    },
  ],
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

const entregadorPremium = computed(() => resumo.value?.entregador_premium === true)

const temCoordenadasNavegacao = computed(() => {
  const r = resumo.value
  if (!r) return false
  return parseCoordenadasValidas(r.latitude, r.longitude) != null
})

const podeConfirmarEntrega = computed(() => {
  if (submitting.value) return false
  if (entregadorPremium.value) return true
  return codigoConfirmacaoNormalizado.value.length >= 1
})

function onCodigoConfirmacaoInput(event: Event) {
  const el = event.target as HTMLInputElement | null
  const raw = String(el?.value ?? '').slice(0, CODIGO_CONFIRM_MAX)
  codigoConfirmacao.value = raw
}

const step = computed(() => {
  const r = resumo.value
  if (!r) return 0
  if (r.entrega_status === 'entregue') return 4
  if (!r.entregador_identificado) return 1
  // Após identificar, já vem como coletado → próximo é chegada
  if (r.entrega_status === 'coletado' || r.entrega_status === 'aguardando_entregador') return 2
  if (r.entrega_status === 'no_local') return 3
  return 1
})

const stepLabel = computed(() => {
  switch (step.value) {
    case 1:
      return 'Passo 1 de 3'
    case 2:
      return 'Passo 2 de 3'
    case 3:
      return 'Passo 3 de 3'
    case 4:
      return 'Concluído'
    default:
      return ''
  }
})

const progressoTotal = 3
const progressoAtivo = computed(() => {
  if (step.value <= 0) return 0
  if (step.value >= 4) return progressoTotal
  return step.value
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
    const res = await $fetch<{
      ok: true
      data: EntregaPublicaResumo
      coleta: {
        workspace_id: number
        conversa_key: string
        funil_id: number
        coluna_id: number
        id_agendamento_mensagem: string | null
        canal_id: number | null
        conversa_atualizada?: boolean
        webhook_disparado?: boolean
        webhook_erro?: string | null
        pusher_ok?: boolean
      } | null
      coleta_erro: string | null
    }>(`/api/public/entrega/${token.value}/identificar`, {
      method: 'POST',
      body: { codigo: codigoEntregador.value },
    })
    resumo.value = res.data
    codigoEntregador.value = ''
    const coletaStore = useEntregaColetaStore()
    coletaStore.setFromAutomacao(token.value, res.coleta, res.coleta_erro)
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
    const res = await $fetch<{
      ok: true
      data: EntregaPublicaResumo
      coleta?: {
        workspace_id: number
        conversa_key: string
        funil_id: number
        coluna_id: number
        id_agendamento_mensagem: string | null
        canal_id: number | null
        conversa_atualizada?: boolean
        webhook_disparado?: boolean
        webhook_erro?: string | null
        pusher_ok?: boolean
      } | null
      coleta_erro?: string | null
    }>(`/api/public/entrega/${token.value}/status`, {
      method: 'POST',
      body: { acao },
    })
    resumo.value = res.data
    if (res.coleta || res.coleta_erro) {
      useEntregaColetaStore().setFromAutomacao(
        token.value,
        res.coleta ?? null,
        res.coleta_erro ?? null,
      )
    }
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
    const res = await $fetch<{
      ok: true
      data: EntregaPublicaResumo
      coleta: {
        workspace_id: number
        conversa_key: string
        funil_id: number
        coluna_id: number
        id_agendamento_mensagem: string | null
        canal_id: number | null
        coluna_ordem?: number
        etapa?: 'coletado' | 'no_local' | 'entregue'
        conversa_atualizada?: boolean
        webhook_disparado?: boolean
        webhook_erro?: string | null
        pusher_ok?: boolean
      } | null
      coleta_erro: string | null
    }>(`/api/public/entrega/${token.value}/entregar`, {
      method: 'POST',
      body: entregadorPremium.value
        ? {}
        : { codigo_confirmacao: codigoConfirmacaoNormalizado.value },
    })
    resumo.value = res.data
    codigoConfirmacao.value = ''
    useEntregaColetaStore().setFromAutomacao(token.value, res.coleta, res.coleta_erro)
  } catch (err) {
    erro.value = mensagemErro(err, 'Não foi possível confirmar a entrega.')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  useEntregaColetaStore().reset()
  void carregar()
})
</script>

<template>
  <div
    class="entrega-page min-h-[100dvh] bg-slate-100 text-slate-900"
  >
    <div
      class="mx-auto flex w-full max-w-lg flex-col px-4 py-5 sm:px-6 sm:py-8 md:max-w-xl md:px-8 md:py-10"
      style="padding-top: max(1.25rem, env(safe-area-inset-top)); padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));"
    >
      <header class="mb-5 text-center sm:mb-6 md:mb-8">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
          Entrega
        </p>
        <h1 class="mt-1 break-words text-xl font-bold leading-tight sm:text-2xl md:text-3xl">
          {{ resumo?.loja_nome || 'Pedido' }}
        </h1>
        <p v-if="resumo" class="mt-1 text-sm text-slate-600 sm:text-base">
          Pedido {{ resumo.pedido_label }}
        </p>
        <p
          v-if="stepLabel && resumo && step >= 1 && step <= 4"
          class="mt-2 text-xs font-medium text-slate-400 sm:text-sm"
        >
          {{ stepLabel }}
        </p>
      </header>

      <!-- Progresso visual (3 passos) -->
      <div
        v-if="resumo && step >= 1 && step <= 3"
        class="mb-4 flex gap-1.5 sm:mb-5 sm:gap-2"
        aria-hidden="true"
      >
        <span
          v-for="n in progressoTotal"
          :key="n"
          class="h-1.5 flex-1 rounded-full transition-colors sm:h-2"
          :class="n <= progressoAtivo ? 'bg-slate-900' : 'bg-slate-300'"
        />
      </div>

      <div
        v-if="loading"
        class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm sm:p-8 sm:text-base"
      >
        Carregando…
      </div>

      <div
        v-else-if="!resumo"
        class="rounded-2xl bg-white p-5 shadow-sm sm:p-6"
      >
        <p class="text-sm text-red-600 sm:text-base">{{ erro || 'Pedido não encontrado.' }}</p>
      </div>

      <div
        v-else
        class="flex flex-col gap-3 sm:gap-4"
      >
        <div class="rounded-2xl bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <dl class="space-y-3 text-sm sm:text-base">
            <div
              v-if="resumo.cliente_nome"
              class="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <dt class="shrink-0 text-slate-500">Cliente</dt>
              <dd class="break-words font-medium sm:text-right">{{ resumo.cliente_nome }}</dd>
            </div>
            <div
              v-if="resumo.endereco"
              class="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <dt class="shrink-0 text-slate-500">Endereço</dt>
              <dd class="break-words font-medium leading-snug sm:max-w-[70%] sm:text-right">
                {{ resumo.endereco }}
              </dd>
            </div>
            <div
              v-if="resumo.entregador_nome"
              class="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <dt class="shrink-0 text-slate-500">Entregador</dt>
              <dd class="sm:text-right">
                <p class="break-words font-medium">{{ resumo.entregador_nome }}</p>
                <p
                  v-if="resumo.entregador_premium"
                  class="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 sm:justify-end sm:text-sm"
                >
                  <svg
                    class="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2.5l2.47 6.64 7.03.37-5.42 4.42 1.74 6.82L12 16.9l-5.82 3.85 1.74-6.82-5.42-4.42 7.03-.37L12 2.5z" />
                  </svg>
                  Premium
                </p>
                <p
                  v-else
                  class="mt-0.5 text-xs text-slate-400 sm:text-sm"
                >
                  Padrão
                </p>
              </dd>
            </div>
          </dl>
          <EntregaNavegacaoMapas
            v-if="temCoordenadasNavegacao"
            class="mt-4 border-t border-slate-100 pt-4"
            :latitude="resumo.latitude"
            :longitude="resumo.longitude"
            variant="entrega"
          />
        </div>

        <p
          v-if="erro"
          class="rounded-xl bg-red-50 px-4 py-3 text-sm leading-snug text-red-700 sm:text-base"
        >
          {{ erro }}
        </p>

        <!-- Step 4: concluído -->
        <div
          v-if="step === 4"
          class="rounded-2xl bg-emerald-50 p-5 text-center shadow-sm sm:p-6 md:p-8"
        >
          <p class="text-lg font-bold text-emerald-800 sm:text-xl">Entrega concluída</p>
          <p class="mt-2 text-sm text-emerald-700 sm:text-base">
            O pedido foi marcado como entregue com sucesso.
          </p>
        </div>

        <!-- Step 1: código entregador (+ coleta automática no backend) -->
        <form
          v-else-if="step === 1"
          class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5 md:p-6"
          @submit.prevent="identificar"
        >
          <div>
            <h2 class="text-base font-semibold sm:text-lg">Identificação</h2>
            <p class="mt-1 text-sm leading-snug text-slate-500 sm:text-base">
              Digite o seu código de entregador para começar. A coleta do pedido será registrada automaticamente.
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
              class="entrega-input w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base outline-none focus:border-slate-400 sm:py-3.5"
              :disabled="submitting"
            />
          </label>
          <button
            type="submit"
            class="entrega-btn w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60 sm:py-3.5"
            :disabled="submitting || !codigoEntregador.trim()"
          >
            {{ submitting ? 'Validando…' : 'Continuar' }}
          </button>
        </form>

        <!-- Step 2: chegou no local -->
        <div
          v-else-if="step === 2"
          class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5 md:p-6"
        >
          <div>
            <h2 class="text-base font-semibold sm:text-lg">Chegada</h2>
            <p class="mt-1 text-sm leading-snug text-slate-500 sm:text-base">
              Confirme quando chegar no endereço de entrega.
            </p>
          </div>
          <button
            type="button"
            class="entrega-btn w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            :disabled="submitting"
            @click="avancarStatus('no_local')"
          >
            {{ submitting ? 'Salvando…' : 'Cheguei no local' }}
          </button>
        </div>

        <!-- Step 3: código cliente (premium confirma sem código) -->
        <form
          v-else-if="step === 3"
          class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5 md:p-6"
          @submit.prevent="confirmarEntrega"
        >
          <div>
            <h2 class="text-base font-semibold sm:text-lg">Confirmar entrega</h2>
            <p class="mt-1 text-sm leading-snug text-slate-500 sm:text-base">
              {{
                entregadorPremium
                  ? 'Como entregador premium, você pode confirmar a entrega sem o código do pedido.'
                  : 'Peça ao cliente o código de confirmação e digite abaixo.'
              }}
            </p>
          </div>
          <label
            v-if="!entregadorPremium"
            class="block"
          >
            <span class="mb-1.5 block text-sm font-medium">Código do cliente</span>
            <input
              :value="codigoConfirmacao"
              type="text"
              autocomplete="one-time-code"
              placeholder="Código do pedido"
              maxlength="64"
              class="entrega-input w-full rounded-xl border border-slate-200 px-3 py-3.5 text-center text-lg font-semibold tracking-wide outline-none focus:border-slate-400 sm:px-4 sm:text-xl"
              :disabled="submitting"
              @input="onCodigoConfirmacaoInput"
            />
          </label>
          <button
            type="submit"
            class="entrega-btn w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            :disabled="!podeConfirmarEntrega"
          >
            {{ submitting ? 'Confirmando…' : 'Confirmar entrega' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entrega-page {
  -webkit-tap-highlight-color: transparent;
}

.entrega-input {
  /* 16px+ evita zoom automático no iOS */
  font-size: 16px;
  min-height: 48px;
}

.entrega-btn {
  min-height: 48px;
  touch-action: manipulation;
}

@media (min-width: 640px) {
  .entrega-input {
    min-height: 52px;
  }

  .entrega-btn {
    min-height: 52px;
  }
}
</style>
