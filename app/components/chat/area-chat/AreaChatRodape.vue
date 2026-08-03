<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import AreaChatRespostaPreview from '~/components/chat/area-chat/AreaChatRespostaPreview.vue'
import CriarAgendamentoModal from '~/components/agendamento-de-mensagem/CriarAgendamentoModal.vue'
import type { ContatoDestinoUi } from '~/components/agendamento-de-mensagem/types'
import BaseTextarea from '~/components/BaseTextarea.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import type { Mensagem, PusherNovaMensagemPayload } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import { mensagemErroFetch } from '~/stores/canais'
import { useAgendamentosMensagensStore } from '~/stores/agendamentosMensagens'

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
const {
  isRecording,
  isPaused,
  recordSeconds,
  formatRecordTime,
  startRecording: startRecorder,
  togglePauseRecording,
  cancelRecording,
  stopAndGetAudio,
} = useAudioRecorder()

const conversasStore = useConversasStore()
const canaisStore = useCanaisStore()
const mensagensStore = useMensagensStore()
const workspacesStore = useWorkspacesStore()
const agendamentosStore = useAgendamentosMensagensStore()
const { items } = storeToRefs(conversasStore)
const { conversaKeyAtiva } = useConversaKeyAtiva()
const { mensagemEmResposta } = storeToRefs(mensagensStore)

const modalAgendamentoAberto = ref(false)

const conversaKeyResolvida = computed(
  () => props.contextoExterno?.conversaKey ?? conversaKeyAtiva.value ?? null,
)

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
  () => conversaKeyResolvida.value,
  (key, prev) => {
    if (!key || key === prev) return
    focarInputMensagem()
  },
)

onMounted(() => {
  const key = conversaKeyResolvida.value
  if (key) focarInputMensagem()
})

watch(mensagemEmResposta, (msg) => {
  if (msg) focarInputMensagem()
})

const nomeContatoResposta = computed(() => {
  const key = conversaKeyResolvida.value
  if (!key) return null
  const ext = props.contextoExterno
  if (ext?.name) return ext.name
  return items.value.find((c) => c.key === key)?.name ?? null
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
  const key = conversaKeyResolvida.value
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

/** Contato da conversa atual (Pinia) para pré-preencher o agendamento. */
const prefillContatoAgendamento = computed((): ContatoDestinoUi | null => {
  const key = conversaKeyResolvida.value?.trim()
  if (!key) return null
  const found = conversasStore.findConversaByKey(key)
  const sel = conversaSelecionada.value
  const c = found ?? (sel ? {
    key: sel.key,
    name: sel.name,
    phone: sel.phone,
    photo: sel.photo,
  } : null)
  if (!c?.key) return null
  return {
    key: c.key,
    nomecliente: c.name ?? null,
    telefone: c.phone ?? null,
    photo: c.photo ?? null,
  }
})

const prefillCanalAgendamento = computed(() => {
  const ext = props.contextoExterno
  return ext?.idCanal ?? canaisStore.currentCanalId ?? null
})

function abrirProgramarMensagem() {
  const key = conversaKeyResolvida.value?.trim() || conversasStore.conversaAtual?.trim()
  if (!key) {
    toast.error('Selecione uma conversa para programar a mensagem.')
    return
  }
  if (!prefillContatoAgendamento.value) {
    toast.error('Não foi possível identificar o contato desta conversa.')
    return
  }
  agendamentosStore.limparAgendamentoSelecionado()
  modalAgendamentoAberto.value = true
}

function aoCriadoAgendamentoDoChat() {
  toast.success('Mensagem programada.')
  modalAgendamentoAberto.value = false
}

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
  const conversaKey = ext?.conversaKey ?? String(conversaKeyResolvida.value ?? '')
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

  const emResposta = mensagemEmResposta.value

  const tempId = mensagensStore.addOptimisticTextMessage({
    id_canal: idCanal,
    conversa_key: conversaKey,
    lid: conversaSelecionada.value?.lid ?? null,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    text: t,
    name: conversaSelecionada.value?.name ?? null,
    photo: conversaSelecionada.value?.photo ?? null,
    replyid: emResposta?.message_id ?? null,
    mensagem_citada: emResposta ?? null,
  })

  const replyid = emResposta?.message_id?.trim() || null

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
      ...(replyid ? { replyid } : {}),
    },
  })
    .then((res) => {
      if (replyid) mensagensStore.cancelarResposta()
      confirmOptimisticAfterSend(idCanal, conversaKey, tempId, res, conversaSelecionada.value, {
        fallbackText: t,
        messagetype: 'conversation',
        ...(replyid ? { replyid } : {}),
        ...(emResposta ? { mensagem_citada: emResposta } : {}),
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

async function startRecording() {
  if (isRecording.value) return
  const ctx = ensureCanSend()
  if (!ctx) return
  await startRecorder()
}

async function sendRecordedAudio() {
  if (!isRecording.value) return
  const ctx = ensureCanSend()
  if (!ctx) return
  const { idCanal, conversaKey, telefone, lid } = ctx

  const audio = await stopAndGetAudio()
  if (!audio) return

  const { blob, mime } = audio
  const localUrl = URL.createObjectURL(blob)
  const filename = `audio_${Date.now()}.webm`
  const tempId = mensagensStore.addOptimisticMediaMessage({
    id_canal: idCanal,
    conversa_key: conversaKey,
    lid: conversaSelecionada.value?.lid ?? null,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    messagetype: 'audioMessage',
    media_url: localUrl,
    caption: null,
    filename,
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
        filename,
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
      filename,
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
    replyid?: string | null
    mensagem_citada?: Mensagem | null
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
      ...(opts.replyid?.trim() ? { replyid: opts.replyid.trim() } : {}),
      ...(opts.mensagem_citada ? { mensagem_citada: opts.mensagem_citada } : {}),
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
    <AreaChatRespostaPreview
      v-if="mensagemEmResposta"
      :mensagem="mensagemEmResposta"
      :nome-contato="nomeContatoResposta"
      @cancelar="mensagensStore.cancelarResposta()"
    />

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
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              @click="() => { close(); abrirProgramarMensagem() }"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">schedule_send</span>
              Programar mensagem
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
        <template v-if="isRecording">
          <button
            type="button"
            class="flex h-12 w-12 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-95 dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            aria-label="Cancelar gravação"
            @click="cancelRecording"
          >
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>

          <button
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
            type="button"
            class="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            :class="compact ? 'h-10 w-10' : 'h-12 w-12'"
            aria-label="Enviar áudio"
            @click="sendRecordedAudio"
          >
            <span class="material-symbols-outlined" aria-hidden="true">send</span>
          </button>
        </template>

        <button
          v-else-if="hasText"
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
          aria-label="Gravar áudio"
          @click="startRecording"
        >
          <span class="material-symbols-outlined" aria-hidden="true">mic</span>
        </button>
      </div>
    </div>
    <p v-if="isRecording" class="mt-2 text-center text-[11px] text-on-surface-variant dark:text-slate-400">
      <span :class="isPaused ? '' : 'animate-pulse'">●</span>
      {{ isPaused ? 'Pausado' : 'Gravando' }}… {{ formatRecordTime(recordSeconds) }}
    </p>

    <CriarAgendamentoModal
      v-model:open="modalAgendamentoAberto"
      titulo-modal="Programar mensagem"
      :prefill-contato="prefillContatoAgendamento"
      :prefill-canal-id="prefillCanalAgendamento"
      @criado="aoCriadoAgendamentoDoChat"
      @cancelar="agendamentosStore.limparAgendamentoSelecionado()"
    />
  </footer>
</template>
