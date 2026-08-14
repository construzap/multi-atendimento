<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'
import TextoComLinks from '~/components/chat/area-chat/BalaoMensagens/TextoComLinks.vue'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))
const url = computed(() => (props.mensagem.media_url ?? '').trim())
const caption = computed(() => (props.mensagem.caption ?? '').trim())
const previewAberto = ref(false)
const baixando = ref(false)

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))

function abrirPreview() {
  if (!url.value) return
  previewAberto.value = true
}

function fecharPreview() {
  previewAberto.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') fecharPreview()
}

watch(previewAberto, (aberto) => {
  if (!import.meta.client) return
  if (aberto) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

function nomeArquivoDownload(): string {
  const fromMsg = (props.mensagem.filename ?? '').trim()
  if (fromMsg) return fromMsg
  try {
    const pathname = new URL(url.value).pathname
    const base = pathname.split('/').pop()?.split('?')[0] || ''
    if (base && /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(base)) return base
  } catch {
    /* ignore */
  }
  return `imagem-${props.mensagem.message_id || Date.now()}.jpg`
}

async function baixarImagem() {
  if (!url.value || baixando.value) return
  baixando.value = true
  try {
    const res = await fetch(url.value)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = nomeArquivoDownload()
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // Fallback: abre em nova aba se o fetch falhar (CORS etc.)
    window.open(url.value, '_blank', 'noopener,noreferrer')
  } finally {
    baixando.value = false
  }
}
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-2 shadow-sm dark:bg-slate-800">
      <button
        type="button"
        class="mb-2 block w-full cursor-zoom-in overflow-hidden rounded-lg p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        :disabled="!url"
        aria-label="Abrir imagem em tamanho maior"
        @click="abrirPreview"
      >
        <img
          :src="url"
          class="max-h-64 w-full object-cover transition-opacity hover:opacity-95"
          alt="Imagem"
          loading="lazy"
        />
      </button>
      <TextoComLinks
        v-if="caption"
        :texto="caption"
        class="whitespace-pre-wrap break-words px-2 font-body text-sm text-zinc-950 dark:text-slate-200"
      />
      <span class="mt-1 block px-2 text-right text-[10px] text-zinc-600 dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-2 shadow-sm">
      <button
        type="button"
        class="mb-2 block w-full cursor-zoom-in overflow-hidden rounded-lg p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        :disabled="!url"
        aria-label="Abrir imagem em tamanho maior"
        @click="abrirPreview"
      >
        <img
          :src="url"
          class="max-h-64 w-full object-cover transition-opacity hover:opacity-95"
          alt="Imagem"
          loading="lazy"
        />
      </button>
      <TextoComLinks
        v-if="caption"
        :texto="caption"
        class="whitespace-pre-wrap break-words px-2 font-body text-sm text-on-primary-container"
      />
      <div class="mt-1 flex items-center justify-end gap-1 px-2">
        <span class="text-[10px] text-on-primary-container/80">
          {{ hora }}<span v-if="isSending"> · enviando…</span>
        </span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          {{ isSending ? 'done' : 'done_all' }}
        </span>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="previewAberto && url"
        class="fixed inset-0 z-[80] flex flex-col bg-black/90"
        role="dialog"
        aria-modal="true"
        aria-label="Visualização da imagem"
        @click.self="fecharPreview"
      >
        <div class="flex shrink-0 items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            class="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
            :disabled="baixando"
            aria-label="Baixar imagem"
            @click="baixarImagem"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">download</span>
            {{ baixando ? 'Baixando…' : 'Baixar' }}
          </button>
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fechar"
            @click="fecharPreview"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 items-center justify-center p-4" @click.self="fecharPreview">
          <img
            :src="url"
            class="max-h-full max-w-full object-contain"
            alt="Imagem ampliada"
            @click.stop
          />
        </div>

        <p
          v-if="caption"
          class="mx-auto max-w-2xl shrink-0 px-4 pb-6 text-center text-sm text-white/85"
        >
          {{ caption }}
        </p>
      </div>
    </Transition>
  </Teleport>
</template>
