<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'
import type { Conversa } from '#shared/types/conversa'
import { storeToRefs } from 'pinia'
import BaseAvatar from '~/components/BaseAvatar.vue'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))
const url = computed(() => (props.mensagem.media_url ?? '').trim())

const conversasStore = useConversasStore()
const { conversaAtual, items } = storeToRefs(conversasStore)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function sortIsoAsc(a: string | null, b: string | null): number {
  const da = a ? new Date(a).getTime() : 0
  const db = b ? new Date(b).getTime() : 0
  return da - db
}

const conversaSelecionada = computed<Conversa | null>(() => {
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null

  const filtrada = list.filter((m) => m.key === key)
  if (!filtrada.length) return null

  const sorted = [...filtrada].sort((a, b) => {
    const ta = a.updated_at ?? a.created_at
    const tb = b.updated_at ?? b.created_at
    return sortIsoAsc(ta ?? null, tb ?? null)
  })
  return sorted[sorted.length - 1] ?? null
})

const avatarUrl = computed<string>(() => (conversaSelecionada.value?.photo ?? '').trim())
const avatarAlt = computed(() => firstNonEmpty(conversaSelecionada.value?.name, conversaSelecionada.value?.phone, conversaAtual.value))

const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const duration = ref(0)
const current = ref(0)

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const currentLabel = computed(() => formatTime(current.value))
const durationLabel = computed(() => formatTime(duration.value))
const progress = computed(() => {
  if (!duration.value) return 0
  return clamp((current.value / duration.value) * 100, 0, 100)
})

function syncFromAudio() {
  const el = audioEl.value
  if (!el) return
  duration.value = Number.isFinite(el.duration) ? el.duration : 0
  current.value = Number.isFinite(el.currentTime) ? el.currentTime : 0
}

async function togglePlay() {
  const el = audioEl.value
  if (!el) return

  try {
    if (el.paused) {
      await el.play()
      isPlaying.value = true
    } else {
      el.pause()
      isPlaying.value = false
    }
  } catch {
    // ignore
  }
}

function onSeek(e: Event) {
  const el = audioEl.value
  if (!el) return
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  const next = (clamp(v, 0, 100) / 100) * (duration.value || 0)
  el.currentTime = next
  current.value = next
}

function onEnded() {
  isPlaying.value = false
  current.value = 0
}

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))

onMounted(() => {
  const el = audioEl.value
  if (!el) return
  const onTime = () => syncFromAudio()
  const onMeta = () => syncFromAudio()
  const onPlay = () => { isPlaying.value = true }
  const onPause = () => { isPlaying.value = false }
  el.addEventListener('timeupdate', onTime)
  el.addEventListener('loadedmetadata', onMeta)
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('ended', onEnded)
  syncFromAudio()

  onBeforeUnmount(() => {
    el.removeEventListener('timeupdate', onTime)
    el.removeEventListener('loadedmetadata', onMeta)
    el.removeEventListener('play', onPlay)
    el.removeEventListener('pause', onPause)
    el.removeEventListener('ended', onEnded)
  })
})
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-3 shadow-sm dark:bg-slate-800">
      <audio ref="audioEl" :src="url" preload="metadata" class="hidden" />

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-slate-900 shadow-sm hover:bg-white/80 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          :aria-label="isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'"
          @click="togglePlay"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">
            {{ isPlaying ? 'pause' : 'play_arrow' }}
          </span>
        </button>

        <div class="min-w-0 flex-1">
          <input
            class="h-2 w-full cursor-pointer accent-primary"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progress"
            @input="onSeek"
          />
          <div class="mt-1 flex items-center justify-between text-[10px] text-on-surface-variant dark:text-slate-400">
            <span>{{ currentLabel }}</span>
            <span>{{ durationLabel }}</span>
          </div>
        </div>

        <BaseAvatar
          :image-url="avatarUrl || undefined"
          :alt="avatarAlt"
          :size="40"
          variant="circle"
          class="shrink-0"
          fallback-class="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
      </div>

      <span class="mt-1 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-3 shadow-sm">
      <audio ref="audioEl" :src="url" preload="metadata" class="hidden" />

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-on-primary-container shadow-sm hover:bg-black/15"
          :aria-label="isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'"
          @click="togglePlay"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">
            {{ isPlaying ? 'pause' : 'play_arrow' }}
          </span>
        </button>

        <div class="min-w-0 flex-1">
          <input
            class="h-2 w-full cursor-pointer accent-on-primary-container"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progress"
            @input="onSeek"
          />
          <div class="mt-1 flex items-center justify-between text-[10px] text-on-primary-container/80">
            <span>{{ currentLabel }}</span>
            <span>{{ durationLabel }}</span>
          </div>
        </div>
      </div>

      <div class="mt-1 flex items-center justify-end gap-1">
        <span class="text-[10px] text-on-primary-container/80">
          {{ hora }}<span v-if="isSending"> · enviando…</span>
        </span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          {{ isSending ? 'done' : 'done_all' }}
        </span>
      </div>
    </div>
  </div>
</template>

