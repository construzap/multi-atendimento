<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseTextarea from '~/components/BaseTextarea.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import { mensagemErroFetch } from '~/stores/canais'

export type AreaChatRodapeContexto = {
  conversaKey: string
  idCanal: number
  workspaceId: number | string
  telefone?: string | null
  lid?: string | null
  name?: string | null
  photo?: string | null
}

const props = withDefaults(
  defineProps<{
    /** Contexto fixo (ex.: modal kanban) em vez de conversas/canais stores. */
    contextoExterno?: AreaChatRodapeContexto | null
    compact?: boolean
    inputId?: string
  }>(),
  {
    contextoExterno: null,
    compact: false,
    inputId: 'chat-mensagem-input',
  },
)

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
const mensagemInputRef = ref<{ focus: () => void } | null>(null)

function focarInputMensagem() {
  nextTick(() => {
    mensagemInputRef.value?.focus()
  })
}

watch(
  () => props.contextoExterno?.conversaKey ?? conversaAtual.value,
  (key, prev) => {
    if (!key || key === prev) return
    focarInputMensagem()
  },
)

onMounted(() => {
  const key = props.contextoExterno?.conversaKey ?? conversaAtual.value
  if (key) focarInputMensagem()
})

type ConversaCtx = {
  key: string
  phone: string | null
  lid: string | null
  name: string | null
  photo: string | null
}

const conversaSelecionada = computed((): ConversaCtx | null => {
  const ext = props.contextoExterno
  if (ext) {
    return {
      key: ext.conversaKey,
      phone: ext.telefone ?? null,
      lid: ext.lid ?? null,
      name: ext.name ?? null,
      photo: ext.photo ?? null,
    }
  }
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null
  const found = list.find((c) => c.key === key)
  if (!found) return null
  return {
    key: found.key,
    phone: found.phone ?? null,
    lid: found.lid ?? null,
    name: found.name ?? null,
    photo: found.photo ?? null,
  }
})

const workspaceIdEnvio = computed(() => {
  const ext = props.contextoExterno?.workspaceId
  if (ext != null && String(ext).trim()) return ext
  return workspacesStore.currentWorkspaceId
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
  const ext = props.contextoExterno
  const idCanal = ext?.idCanal ?? canaisStore.currentCanalId
  if (!idCanal) {
    toast.error(ext ? 'Canal da conversa não encontrado.' : 'Selecione um canal antes de enviar.')
    return null
  }
  const tel = phoneOpt.value
  const lid = lidOpt.value
  if (!tel && !lid) {
    toast.error('Esta conversa não tem telefone nem LID para enviar.')
    return null
  }
  const conversaKey = ext?.conversaKey ?? String(conversaAtual.value ?? '')
  if (!conversaKey) return null
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

  void $fetch<UazapiSendRes>('/api/mensagens', {
    method: 'POST',
    body: {
      id_canal: idCanal,
      workspace_id: workspaceIdEnvio.value,
      ...(telefone ? { telefone } : {}),
      ...(lid ? { lid } : {}),
      conteudo: t,
      temp_id: tempId,
      conversa_sessao: conversaKey,
    },
  })
    .then((res) => {
      confirmOptimisticAfterSend(idCanal, conversaKey, tempId, res, conversaSelecionada.value, {
        fallbackText: t,
        messagetype: 'conversation',
      })
    })
    .catch((err: unknown) => {
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
    const res = await $fetch<UazapiSendRes>('/api/mensagens', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        workspace_id: workspaceIdEnvio.value,
        ...(telefone ? { telefone } : {}),
        ...(lid ? { lid } : {}),
        conteudo: caption,
        temp_id: tempId,
        conversa_sessao: conversaKey,
        media_type: kind,
        media_file: url,
      },
    })
    confirmOptimisticAfterSend(idCanal, conversaKey, tempId, res, conversaSelecionada.value, {
      fallbackText: caption,
      messagetype,
      media_url: url,
      caption: caption || null,
      filename: file.name || null,
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

    const res = await $fetch<UazapiSendRes>('/api/mensagens', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        workspace_id: workspaceIdEnvio.value,
        ...(telefone ? { telefone } : {}),
        ...(lid ? { lid } : {}),
        conteudo: '',
        temp_id: tempId,
        conversa_sessao: conversaKey,
        media_type: 'ptt',
        media_file: url,
      },
    })
    confirmOptimisticAfterSend(idCanal, conversaKey, tempId, res, conversaSelecionada.value, {
      messagetype: 'audioMessage',
      media_url: url,
      filename: `audio_${Date.now()}.webm`,
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

type UazapiSendRes = {
  messageid?: unknown
  text?: unknown
  messageTimestamp?: unknown
  response?: { fileUrl?: string }
  fileURL?: string
}

function uazapiTimestampToMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return Date.now()
  return raw > 1e12 ? raw : raw * 1000
}

/** Confirma mensagem otimista após POST ok (fallback quando Pusher ainda não inscreveu no canal). */
function confirmOptimisticAfterSend(
  idCanal: number,
  conversaKey: string,
  tempId: string,
  res: UazapiSendRes,
  conv: ConversaCtx | null,
  opts: {
    fallbackText?: string
    messagetype?: MessageType | null
    media_url?: string | null
    caption?: string | null
    filename?: string | null
  } = {},
) {
  const rawId = res?.messageid
  const message_id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : String(rawId ?? '').trim()
  if (!message_id) return

  const messagetype = opts.messagetype ?? 'conversation'
  const messageText =
    typeof res?.text === 'string' && res.text.trim()
      ? res.text.trim()
      : (opts.fallbackText ?? '').trim()
  const fileUrlFromRes =
    (typeof res?.response?.fileUrl === 'string' && res.response.fileUrl.trim()) ||
    (typeof res?.fileURL === 'string' && res.fileURL.trim()) ||
    ''
  const isMedia = messagetype !== 'conversation'
  const media_url = isMedia ? (fileUrlFromRes || opts.media_url || null) : null
  const caption = isMedia && (opts.caption ?? messageText) ? (opts.caption ?? messageText) : null

  const payload: PusherNovaMensagemPayload = {
    conversa_key: conversaKey,
    mensagem: {
      key_conversa: conversaKey,
      temp_id: tempId,
      message_id,
      created_at: new Date(uazapiTimestampToMs(res.messageTimestamp)).toISOString(),
      from_me: true,
      message: isMedia ? caption : (messageText || null),
      phone: conv?.phone ?? null,
      lid: conv?.lid ?? null,
      connected_phone: null,
      messagetype,
      from_api: true,
      id_canal: idCanal,
      media_url,
      caption,
      filename: opts.filename ?? null,
      name: conv?.name ?? null,
      photo: conv?.photo ?? null,
    },
  }

  mensagensStore.mergeFromPusherNovaMensagem(idCanal, payload)
}
</script>

<template>
  <footer
    class="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest dark:bg-slate-900"
    :class="compact ? 'p-3' : 'p-6'"
  >
    <div class="flex items-end gap-3" :class="compact ? 'gap-2' : 'gap-4'">
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
          ref="mensagemInputRef"
          :id="inputId"
          v-model="mensagem"
          name="mensagem"
          placeholder="Escreva sua mensagem..."
          title="Enter envia a mensagem · Shift+Enter quebra linha"
          autocomplete="off"
          :wrapper-id="`${inputId}-wrap`"
          :min-height-px="compact ? 44 : 48"
          :max-height-px="compact ? 120 : 160"
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
          class="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          :class="compact ? 'h-10 w-10' : 'h-12 w-12'"
          aria-label="Enviar mensagem"
          @click="enviarMensagem"
        >
          <span class="material-symbols-outlined" aria-hidden="true">send</span>
        </button>

        <button
          v-else
          type="button"
          class="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          :class="compact ? 'h-10 w-10' : 'h-12 w-12'"
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
