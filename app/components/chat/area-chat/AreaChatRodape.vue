<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseTextarea from '~/components/BaseTextarea.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { mensagemErroFetch } from '~/stores/canais'

const mensagem = ref('')
const isRecording = ref(false)
const isPaused = ref(false)
const recordSeconds = ref(0)
let recordTimer: ReturnType<typeof setInterval> | null = null
let recorder: MediaRecorder | null = null
let recordChunks: BlobPart[] = []
let recordMime: string | null = null

const conversasStore = useConversasStore()
const canaisStore = useCanaisStore()
const mensagensStore = useMensagensStore()
const workspacesStore = useWorkspacesStore()
const { conversaAtual, items } = storeToRefs(conversasStore)

const fileInputImage = ref<HTMLInputElement | null>(null)
const fileInputVideo = ref<HTMLInputElement | null>(null)
const fileInputDocument = ref<HTMLInputElement | null>(null)

const conversaSelecionada = computed(() => {
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null
  return list.find((c) => c.key === key) ?? null
})

const phoneOpt = computed(() => {
  const p = conversaSelecionada.value?.phone
  return typeof p === 'string' && p.trim() ? p.trim() : ''
})

const lidOpt = computed(() => {
  const l = conversaSelecionada.value?.lid
  return typeof l === 'string' && l.trim() ? l.trim() : ''
})

function ensureCanSend(): {
  idCanal: number
  conversaKey: string
  telefone?: string
  lid?: string
} | null {
  const idCanal = canaisStore.currentCanalId
  if (!idCanal) {
    toast.error('Selecione um canal antes de enviar.')
    return null
  }
  const tel = phoneOpt.value
  const lid = lidOpt.value
  if (!tel && !lid) {
    toast.error('Esta conversa não tem telefone nem LID para enviar.')
    return null
  }
  const conversaKey = String(conversaAtual.value)
  return {
    idCanal,
    conversaKey,
    ...(tel ? { telefone: tel } : {}),
    ...(lid ? { lid } : {}),
  }
}

function enviarMensagem() {
  const t = mensagem.value.trim()
  if (!t) return
  const ctx = ensureCanSend()
  if (!ctx) return
  const { idCanal, conversaKey, telefone, lid } = ctx

  const tempId = mensagensStore.addOptimisticTextMessage({
    id_canal: idCanal,
    conversa_key: conversaKey,
    lid: conversaSelecionada.value?.lid ?? null,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    text: t,
    name: conversaSelecionada.value?.name ?? null,
    photo: conversaSelecionada.value?.photo ?? null,
  })

  mensagem.value = ''

  void $fetch('/api/mensagens', {
    method: 'POST',
    body: {
      id_canal: idCanal,
      workspace_id: workspacesStore.currentWorkspaceId,
      ...(telefone ? { telefone } : {}),
      ...(lid ? { lid } : {}),
      conteudo: t,
      temp_id: tempId,
      conversa_sessao: conversaKey,
    },
  }).catch((err: unknown) => {
    mensagensStore.removeByTempId(conversaKey, tempId)
    const msg = mensagemErroFetch(err, 'Não foi possível enviar a mensagem.')
    toast.error(msg, { duration: 8000 })
  })
}

async function uploadFileToB2(idCanal: number, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Falha ao ler arquivo.'))
    r.onload = () => resolve(String(r.result ?? ''))
    r.readAsDataURL(file)
  })

  const res = await $fetch<{ ok: true; url: string }>('/api/uploads', {
    method: 'POST',
    body: {
      id_canal: idCanal,
      mime: file.type || 'application/octet-stream',
      filename: file.name,
      data_base64: base64,
    },
  })
  return res.url
}

async function enviarMidia(kind: 'image' | 'video' | 'document', file: File) {
  const ctx = ensureCanSend()
  if (!ctx) return
  const { idCanal, conversaKey, telefone, lid } = ctx

  const caption = mensagem.value.trim()
  mensagem.value = ''

  const localUrl = URL.createObjectURL(file)
  const messagetype =
    kind === 'image'
      ? 'imageMessage'
      : kind === 'video'
        ? 'videoMessage'
        : 'documentMessage'

  const tempId = mensagensStore.addOptimisticMediaMessage({
    id_canal: idCanal,
    conversa_key: conversaKey,
    lid: conversaSelecionada.value?.lid ?? null,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    messagetype,
    media_url: localUrl,
    caption: caption || null,
    filename: file.name || null,
    name: conversaSelecionada.value?.name ?? null,
    photo: conversaSelecionada.value?.photo ?? null,
  })

  try {
    const url = await uploadFileToB2(idCanal, file)
    await $fetch('/api/mensagens', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        workspace_id: workspacesStore.currentWorkspaceId,
        ...(telefone ? { telefone } : {}),
        ...(lid ? { lid } : {}),
        conteudo: caption,
        temp_id: tempId,
        conversa_sessao: conversaKey,
        media_type: kind,
        media_file: url,
      },
    })
  } catch (err: unknown) {
    mensagensStore.removeByTempId(conversaKey, tempId)
    const msg = mensagemErroFetch(err, 'Não foi possível enviar a mídia.')
    toast.error(msg, { duration: 8000 })
  } finally {
    // evita acumular object URLs
    try { URL.revokeObjectURL(localUrl) } catch {}
  }
}

function onPick(kind: 'image' | 'video' | 'document') {
  const map = {
    image: fileInputImage,
    video: fileInputVideo,
    document: fileInputDocument,
  } as const
  map[kind].value?.click()
}

async function onFileSelected(kind: 'image' | 'video' | 'document', e: Event) {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  if (input) input.value = ''
  if (!file) return
  await enviarMidia(kind, file)
}

function clearRecordTimer() {
  if (recordTimer) clearInterval(recordTimer)
  recordTimer = null
}

async function startRecording() {
  if (isRecording.value) return
  const ctx = ensureCanSend()
  if (!ctx) return

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    toast.error('Permita o microfone para gravar áudio.')
    return
  }

  recordChunks = []
  recordSeconds.value = 0
  isPaused.value = false

  try {
    recorder = new MediaRecorder(stream)
  } catch {
    stream.getTracks().forEach((t) => t.stop())
    toast.error('Seu navegador não suporta gravação de áudio.')
    return
  }

  recordMime = recorder.mimeType || null
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) recordChunks.push(ev.data)
  }
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop())
  }

  recorder.start()
  isRecording.value = true
  clearRecordTimer()
  recordTimer = setInterval(() => {
    recordSeconds.value += 1
  }, 1000)
}

function togglePauseRecording() {
  if (!recorder || !isRecording.value) return
  if (recorder.state === 'recording') {
    recorder.pause()
    isPaused.value = true
    clearRecordTimer()
    return
  }
  if (recorder.state === 'paused') {
    recorder.resume()
    isPaused.value = false
    clearRecordTimer()
    recordTimer = setInterval(() => {
      recordSeconds.value += 1
    }, 1000)
  }
}

async function sendRecordedAudio() {
  if (!recorder || !isRecording.value) return
  const ctx = ensureCanSend()
  if (!ctx) return
  const { idCanal, conversaKey, telefone, lid } = ctx

  const r = recorder
  const mime = recordMime || 'audio/webm'

  // encerra gravação e espera o evento de stop fechar o stream
  clearRecordTimer()
  isRecording.value = false
  isPaused.value = false
  recorder = null

  // força flush final
  try { r.requestData?.() } catch {}
  try { r.stop() } catch {}

  // pequena espera pro browser emitir dataavailable final
  await new Promise((resolve) => setTimeout(resolve, 50))

  const blob = new Blob(recordChunks, { type: mime })
  recordChunks = []
  if (blob.size === 0) {
    toast.error('Áudio vazio.')
    return
  }

  const localUrl = URL.createObjectURL(blob)
  const tempId = mensagensStore.addOptimisticMediaMessage({
    id_canal: idCanal,
    conversa_key: conversaKey,
    lid: conversaSelecionada.value?.lid ?? null,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    messagetype: 'audioMessage',
    media_url: localUrl,
    caption: null,
    filename: `audio_${Date.now()}.webm`,
    name: conversaSelecionada.value?.name ?? null,
    photo: conversaSelecionada.value?.photo ?? null,
  })

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onerror = () => reject(new Error('Falha ao ler áudio.'))
      fr.onload = () => resolve(String(fr.result ?? ''))
      fr.readAsDataURL(blob)
    })
    const url = await $fetch<{ ok: true; url: string }>('/api/uploads', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        mime,
        filename: `audio_${Date.now()}.webm`,
        data_base64: base64,
      },
    }).then((x) => x.url)

    await $fetch('/api/mensagens', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        workspace_id: workspacesStore.currentWorkspaceId,
        ...(telefone ? { telefone } : {}),
        ...(lid ? { lid } : {}),
        conteudo: '',
        temp_id: tempId,
        conversa_sessao: conversaKey,
        media_type: 'ptt',
        media_file: url,
      },
    })
  } catch (err: unknown) {
    mensagensStore.removeByTempId(conversaKey, tempId)
    const msg = mensagemErroFetch(err, 'Não foi possível enviar o áudio.')
    toast.error(msg, { duration: 8000 })
  } finally {
    try { URL.revokeObjectURL(localUrl) } catch {}
  }
}

const hasText = computed(() => Boolean(mensagem.value.trim()))
</script>

<template>
  <footer
    class="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest p-6 dark:bg-slate-900"
  >
    <div class="flex items-end gap-4">
      <BaseDropdown title="Enviar mídia" align="left" side="top" panel-class="w-60 min-w-[14rem]">
        <template #trigger>
          <span
            class="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Enviar mídia"
          >
            <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
          </span>
        </template>

        <template #default="{ close }">
          <div class="flex flex-col gap-1">
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              @click="() => { close(); onPick('image') }"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">image</span>
              Enviar imagem
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              @click="() => { close(); onPick('video') }"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">movie</span>
              Enviar vídeo
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              @click="() => { close(); onPick('document') }"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">description</span>
              Enviar documento
            </button>
          </div>
        </template>
      </BaseDropdown>

      <!-- Inputs escondidos -->
      <input
        ref="fileInputImage"
        class="hidden"
        type="file"
        accept="image/*"
        @change="(e) => onFileSelected('image', e)"
      />
      <input
        ref="fileInputVideo"
        class="hidden"
        type="file"
        accept="video/mp4,video/*"
        @change="(e) => onFileSelected('video', e)"
      />
      <input
        ref="fileInputDocument"
        class="hidden"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        @change="(e) => onFileSelected('document', e)"
      />

      <div class="relative min-w-0 flex-1">
        <BaseTextarea
          id="chat-mensagem-input"
          v-model="mensagem"
          name="mensagem"
          placeholder="Escreva sua mensagem..."
          title="Enter envia a mensagem · Shift+Enter quebra linha"
          autocomplete="off"
          wrapper-id="chat-mensagem-wrap"
          :min-height-px="48"
          :max-height-px="160"
          input-class="!rounded-2xl !border-0 bg-surface-container-low !py-3 !pl-6 !pr-28 text-sm leading-relaxed !shadow-none focus:!border-transparent focus:!ring-1 focus:!ring-primary dark:!bg-slate-800 dark:!text-slate-200"
          @submit="enviarMensagem"
        />
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="isRecording"
          type="button"
          class="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          :aria-label="isPaused ? 'Continuar gravação' : 'Pausar gravação'"
          @click="togglePauseRecording"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            {{ isPaused ? 'play_arrow' : 'pause' }}
          </span>
        </button>

        <button
          v-if="hasText"
          type="button"
          class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          aria-label="Enviar mensagem"
          @click="enviarMensagem"
        >
          <span class="material-symbols-outlined" aria-hidden="true">send</span>
        </button>

        <button
          v-else
          type="button"
          class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          :aria-label="isRecording ? 'Enviar áudio' : 'Gravar áudio'"
          @click="isRecording ? sendRecordedAudio() : startRecording()"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            {{ isRecording ? 'send' : 'mic' }}
          </span>
        </button>
      </div>
    </div>
    <p v-if="isRecording" class="mt-2 text-center text-[11px] text-on-surface-variant dark:text-slate-400">
      Gravando áudio… {{ Math.floor(recordSeconds / 60).toString().padStart(2, '0') }}:{{
        (recordSeconds % 60).toString().padStart(2, '0')
      }}
    </p>
  </footer>
</template>
