<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import BaseModal from '~/components/BaseModal.vue'

const props = defineProps<{
  open: boolean
  canalId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const canaisStore = useCanaisStore()

const qrcode = ref<string | null>(null)
const loading = ref(false)
const erro = ref<string | null>(null)
const toast = ref<string | null>(null)

const DURACAO = 60
const tempoRestante = ref(DURACAO)
let timerInterval: ReturnType<typeof setInterval> | null = null

function pararTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function iniciarTimer() {
  pararTimer()
  tempoRestante.value = DURACAO
  timerInterval = setInterval(() => {
    tempoRestante.value--
    if (tempoRestante.value <= 0) {
      pararTimer()
      fechar()
    }
  }, 1000)
}

/** Limpa estado do modal ao abrir (inclui toast de tentativa anterior). */
function resetarEstadoAoAbrir() {
  qrcode.value = null
  loading.value = false
  erro.value = null
  toast.value = null
  pararTimer()
  tempoRestante.value = DURACAO
}

/** Ao fechar o modal: limpa QR/loading/erro mas NÃO o toast — senão o aviso de assinatura some antes de aparecer. */
function limparEstadoAoFecharModal() {
  qrcode.value = null
  loading.value = false
  erro.value = null
  pararTimer()
  tempoRestante.value = DURACAO
}

async function buscarQrCode() {
  const id = props.canalId
  if (!id) return

  loading.value = true
  erro.value = null
  qrcode.value = null

  try {
    const res = await $fetch<{ qrcode: string | null; status: string | null }>('/api/canais/conectar', {
      method: 'POST',
      body: { id_canal: id }
    })
    qrcode.value = res.qrcode ?? null
    if (qrcode.value) iniciarTimer()
  } catch (err: unknown) {
    const maybe = err as {
      data?: Record<string, unknown>
      message?: string
      statusMessage?: string
    }
    const d = maybe.data
    let msg = ''
    if (d && typeof d === 'object') {
      if (typeof d.statusMessage === 'string' && d.statusMessage) msg = d.statusMessage
      else if (typeof d.message === 'string' && d.message) msg = d.message
    }
    if (!msg) msg = maybe.statusMessage || maybe.message || 'Não foi possível gerar o QR code.'

    const isAssinatura =
      msg.toLowerCase().includes('assinatura') ||
      msg.toLowerCase().includes('regularize') ||
      msg.toLowerCase().includes('plano')

    if (isAssinatura) {
      toast.value = msg
      fechar()
    } else {
      erro.value = msg
    }
  } finally {
    loading.value = false
  }
}

async function fechar() {
  pararTimer()
  emit('update:open', false)
  // Ao fechar, atualiza o status da instância para refletir na UI.
  if (props.canalId) {
    await canaisStore.fetchInstanciaStatus(props.canalId).catch(() => {})
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetarEstadoAoAbrir()
      buscarQrCode()
    } else {
      limparEstadoAoFecharModal()
    }
  }
)

onUnmounted(() => {
  pararTimer()
})

const minutos = '0'
const segundosFormatados = computed(() =>
  String(tempoRestante.value).padStart(2, '0')
)

const progressoPct = computed(() => (tempoRestante.value / DURACAO) * 100)
</script>

<template>
  <Teleport to="body">
    <div v-if="toast" class="fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-700/50 dark:bg-amber-900/30">
      <span class="material-symbols-outlined text-amber-600 dark:text-amber-400">warning</span>
      <p class="flex-1 text-sm text-amber-800 dark:text-amber-200">{{ toast }}</p>
      <button type="button" class="ml-2 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-800/40" @click="toast = null">
        <span class="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">close</span>
      </button>
    </div>
  </Teleport>

  <BaseModal
    :open="open"
    title="Conectar WhatsApp"
    panel-class="w-full max-w-sm"
    @update:open="fechar"
    @close="fechar"
  >
    <template #icon>
      <span class="material-symbols-outlined text-[22px]">qr_code_2</span>
    </template>

    <template #subtitle>
      Escaneie o QR code com o WhatsApp para conectar o canal.
    </template>

    <!-- Área do QR code -->
    <div class="flex flex-col items-center gap-5 py-2">
      <!-- Loading -->
      <div v-if="loading" class="flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
        <span class="material-symbols-outlined animate-spin text-4xl text-slate-400">progress_activity</span>
      </div>

      <!-- Erro -->
      <div v-else-if="erro" class="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20">
        <span class="material-symbols-outlined text-3xl text-red-400">error</span>
        <p class="px-4 text-center text-xs text-red-600 dark:text-red-400">{{ erro }}</p>
      </div>

      <!-- QR code -->
      <div v-else-if="qrcode" class="relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <img
          :src="qrcode"
          alt="QR code para conectar o WhatsApp"
          class="h-52 w-52 object-contain"
        />
        <!-- Barra de progresso sobre o QR -->
        <div class="absolute inset-x-3 bottom-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            :style="{ width: `${progressoPct}%` }"
          />
        </div>
      </div>

      <!-- Placeholder vazio (antes de carregar) -->
      <div v-else class="h-56 w-56 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700" />

      <!-- Cronômetro -->
      <div
        v-if="qrcode && !loading"
        class="flex items-center gap-1.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <span class="material-symbols-outlined text-[18px]">timer</span>
        <span class="tabular-nums">
          {{ minutos }}:{{ segundosFormatados }}
        </span>
        <span class="text-xs">restantes</span>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-xl px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
        @click="fechar"
      >
        Fechar
      </button>
    </template>
  </BaseModal>
</template>
