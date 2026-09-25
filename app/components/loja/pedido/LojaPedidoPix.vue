<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { LojaPedidoPublico } from '#shared/types/loja'
import LojaPedidoBotaoJaPaguei from '~/components/loja/pedido/LojaPedidoBotaoJaPaguei.vue'

const props = defineProps<{
  pedido: LojaPedidoPublico
}>()

const emit = defineEmits<{
  expirou: []
}>()

const copiado = ref(false)
const agora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const expiraEmDate = computed(() => parseExpiraEm(props.pedido.pix?.expiraEm))

const expiraEmTexto = computed(() => {
  const d = expiraEmDate.value
  if (!d) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const restanteMs = computed(() => {
  const d = expiraEmDate.value
  if (!d) return null
  return d.getTime() - agora.value
})

const countdown = computed(() => {
  const ms = restanteMs.value
  if (ms == null) return ''
  if (ms <= 0) return 'Expirado'
  const total = Math.floor(ms / 1000)
  const dias = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (dias > 0) {
    const rotulo = dias === 1 ? '1 dia' : `${dias} dias`
    return `${rotulo} ${hh}:${mm}:${ss}`
  }
  if (h > 0) return `${hh}:${mm}:${ss}`
  return `${mm}:${ss}`
})

function iniciarTick() {
  if (!import.meta.client || tick || !expiraEmDate.value) return
  tick = setInterval(() => {
    agora.value = Date.now()
  }, 1000)
}

const expirado = computed(
  () => props.pedido.status === 'expirado' || (restanteMs.value != null && restanteMs.value <= 0),
)

watch(expiraEmDate, () => iniciarTick(), { immediate: true })

watch(expirado, (fim) => {
  if (fim && props.pedido.status !== 'expirado') emit('expirou')
}, { immediate: true })

onUnmounted(() => {
  if (!tick) return
  clearInterval(tick)
  tick = null
})

function parseExpiraEm(raw: string | null | undefined): Date | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const iso = t.includes('T') ? t : t.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const qrSrc = computed(() => {
  const raw = props.pedido.pix?.qrCodeBase64?.trim()
  if (!raw) return null
  if (raw.startsWith('data:')) return raw
  return `data:image/png;base64,${raw}`
})

const payload = computed(() => props.pedido.pix?.payload?.trim() || '')

const valor = computed(() =>
  props.pedido.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
)

async function copiar() {
  if (!payload.value) return
  try {
    await navigator.clipboard.writeText(payload.value)
    copiado.value = true
    window.setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    copiado.value = false
  }
}
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-4 pt-8 text-center">
    <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Pedido #{{ pedido.id }} · {{ valor }}
    </p>
    <h2 class="mt-2 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
      {{ expirado ? 'PIX expirado' : 'Pague com PIX' }}
    </h2>
    <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      {{
        expirado
          ? 'O prazo de 30 minutos acabou. Volte ao carrinho e faça um novo pedido.'
          : 'Escaneie o QR Code ou copie o código. Confirmamos automaticamente.'
      }}
    </p>

    <div
      class="mt-6 flex h-56 w-56 items-center justify-center rounded-3xl border border-outline/30 bg-white p-3 dark:border-dark-outline/30"
    >
      <img
        v-if="qrSrc && !expirado"
        :src="qrSrc"
        alt="QR Code PIX"
        class="h-full w-full object-contain"
      >
      <p v-else-if="expirado" class="px-4 text-sm text-on-surface-variant">
        QR Code encerrado
      </p>
      <p v-else class="px-4 text-sm text-on-surface-variant">
        Gerando QR Code…
      </p>
    </div>

    <div
      v-if="expiraEmTexto"
      class="mt-5 w-full max-w-lg rounded-2xl px-4 py-3"
      :class="
        restanteMs != null && restanteMs <= 0
          ? 'bg-red-500/10'
          : 'bg-[#00C853]/10'
      "
    >
      <p
        class="text-xs font-semibold uppercase tracking-wide"
        :class="restanteMs != null && restanteMs <= 0 ? 'text-red-600' : 'text-[#00C853]'"
      >
        Expira em
      </p>
      <p
        class="mt-1 text-lg font-semibold tabular-nums"
        :class="
          restanteMs != null && restanteMs <= 0
            ? 'text-red-600'
            : 'text-on-surface dark:text-dark-on-surface'
        "
      >
        {{ expiraEmTexto }}
        <span class="ml-1">· {{ countdown }}</span>
      </p>
    </div>

    <button
      v-if="!expirado"
      type="button"
      class="mt-6 flex h-14 w-full max-w-lg items-center justify-center rounded-full bg-[#00C853] px-5 text-base font-semibold text-white shadow-lg disabled:opacity-60"
      :disabled="!payload"
      @click="copiar"
    >
      {{ copiado ? 'Código copiado!' : 'Copiar código PIX' }}
    </button>

    <LojaPedidoBotaoJaPaguei v-if="!expirado" :pedido-id="pedido.id" />

    <p
      v-if="payload && !expirado"
      class="mt-4 max-w-lg break-all rounded-2xl bg-surface-container px-4 py-3 text-left text-xs text-on-surface-variant dark:bg-dark-surface-container dark:text-dark-on-surface-variant"
    >
      {{ payload }}
    </p>
  </section>
</template>
