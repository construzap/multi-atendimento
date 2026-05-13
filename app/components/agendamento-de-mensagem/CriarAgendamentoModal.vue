<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  AgendamentoMensagemAtualizarBody,
  AgendamentoMensagemInserirBody,
  AgendamentoMensagemRow,
  AgendamentoMidiaUploadResponse,
} from '#shared/types/agendamentoMensagens'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import type {
  AgendamentoDiaItem,
  AgendamentoRecorrenciaUi,
  AgendamentoTipoForm,
  ContatoDestinoUi,
  CriarAgendamentoPayloadUi,
  DestinatarioModo,
} from '~/components/agendamento-de-mensagem/types'
import { useWorkspacesStore } from '~/stores/workspaces'
import { useCanaisStore } from '~/stores/canais'
import { OPCOES_FUSO_BRASIL, defaultFusoDoNavegador, isIanaFusoBrasilPermitido } from '#shared/constants/ianaTimezonesBrasil'
import { dataHoraLocalEmFuso, parseDataHoraLocalBrasilParaUtcIso } from '#shared/utils/agendamentoDataUtc'
import { normalizeTelefoneBrParaEnvio } from '#shared/utils/normalizeWhatsappBr'

const opcoesFusoBrasil = OPCOES_FUSO_BRASIL

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Título dinâmico */
    tituloModal?: string
    /** Pré-preenche data (yyyy-mm-dd) ao abrir */
    prefillDate?: string | null
    /** Modo edição: exibe dados iniciais (somente UI) */
    editItem?: AgendamentoDiaItem | null
    /** Lista estática para demonstrar a aba “Contatos” sem backend */
    contatosDemonstracao?: ContatoDestinoUi[]
  }>(),
  {
    tituloModal: 'Criar agendamento',
    prefillDate: null,
    editItem: null,
    contatosDemonstracao: () => [
      { id: 1, nomecliente: 'Maria Silva', telefone: '+55 11 99999-0001' },
      { id: 2, nomecliente: 'João Souza', telefone: '+55 21 98888-1234' },
      { id: 3, nomecliente: 'Cliente', telefone: '+55 47 97777-8899' },
    ],
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Após `PATCH /api/agendamento-de-mensagem/:id` com sucesso. */
  atualizado: [row: AgendamentoMensagemRow]
  /** Após `POST /api/agendamento-de-mensagem` com sucesso. */
  criado: [row: AgendamentoMensagemRow]
  cancelar: []
}>()

const workspacesStore = useWorkspacesStore()
const canaisStore = useCanaisStore()
const route = useRoute()
const submitPending = ref(false)

const tipo = ref<AgendamentoTipoForm>('texto')
const titulo = ref('')
const mensagem = ref('')
const dataCampo = ref('')
const horaCampo = ref('')
const ianaTimezone = ref<string>(defaultFusoDoNavegador())
/** `canais.id` do workspace atual (Pinia `canais.items`). */
const idCanalSelecionado = ref<number | null>(null)
const destMode = ref<DestinatarioModo>('numeros')
const manualNome = ref('')
const manualTelefone = ref('')
const buscaContato = ref('')
const contatoSelecionado = ref<ContatoDestinoUi | null>(null)

const repetirAgendamento = ref(false)
const frequenciaRecorrencia = ref<Exclude<AgendamentoRecorrenciaUi, 'unico'>>('semanal')

const opcoesRecorrencia = [
  { id: 'diaria' as const, label: 'Diária' },
  { id: 'semanal' as const, label: 'Semanal' },
  { id: 'mensal' as const, label: 'Mensal' },
  { id: 'anual' as const, label: 'Anual' },
] as const

const imagemInputRef = ref<HTMLInputElement | null>(null)
const audioInputRef = ref<HTMLInputElement | null>(null)
const imagemNome = ref<string | null>(null)
const audioNome = ref<string | null>(null)
const imagemArquivo = ref<File | null>(null)
const audioArquivo = ref<File | null>(null)
const imagemPreviewUrl = ref<string | null>(null)

const gravandoUi = ref(false)
const elapsedSegundos = ref(0)
let intervalId: ReturnType<typeof setInterval> | null = null

/** Gravação no navegador (microfone) — não reativo. */
let mediaRecorderInst: MediaRecorder | null = null
let gravacaoStreamRef: MediaStream | null = null
const gravacaoChunks: Blob[] = []

const audioObjectUrl = ref<string | null>(null)

watch(audioArquivo, (file) => {
  if (audioObjectUrl.value) {
    globalThis.URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = null
  }
  if (file) {
    audioObjectUrl.value = globalThis.URL.createObjectURL(file)
  }
})

function limparTimerGravacao() {
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function encerrarSomenteGravadorMicrofone() {
  limparTimerGravacao()
  gravandoUi.value = false
  elapsedSegundos.value = 0
  if (mediaRecorderInst) {
    try {
      mediaRecorderInst.ondataavailable = null
      mediaRecorderInst.onstop = null
      if (mediaRecorderInst.state === 'recording' || mediaRecorderInst.state === 'paused') {
        mediaRecorderInst.stop()
      }
    } catch {
      /* ignore */
    }
    mediaRecorderInst = null
  }
  pararTracksGravacao()
  gravacaoChunks.length = 0
}

function pararTracksGravacao() {
  gravacaoStreamRef?.getTracks().forEach((t) => t.stop())
  gravacaoStreamRef = null
}

/**
 * Fechar modal sem criar (ou backdrop): revoga URLs, apaga arquivos em memória e para o microfone.
 */
function abortarMidiaTemporariaNavegador() {
  encerrarSomenteGravadorMicrofone()

  if (imagemPreviewUrl.value) globalThis.URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = null
  imagemArquivo.value = null
  imagemNome.value = null
  if (imagemInputRef.value) imagemInputRef.value.value = ''

  audioArquivo.value = null
  audioNome.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
}

async function toggleGravacaoAudio() {
  if (gravandoUi.value) {
    if (mediaRecorderInst?.state === 'recording' || mediaRecorderInst?.state === 'paused') {
      mediaRecorderInst.stop()
    } else {
      encerrarSomenteGravadorMicrofone()
    }
    return
  }

  if (!import.meta.client) return

  gravacaoChunks.length = 0

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    gravacaoStreamRef = stream

    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    let mimeEscolhido = ''
    for (const c of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        mimeEscolhido = c
        break
      }
    }

    const mr = new MediaRecorder(stream, mimeEscolhido ? { mimeType: mimeEscolhido } : undefined)

    mr.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) gravacaoChunks.push(ev.data)
    }

    mr.onstop = () => {
      pararTracksGravacao()
      limparTimerGravacao()
      gravandoUi.value = false
      elapsedSegundos.value = 0
      mediaRecorderInst = null

      const blobType = (mr.mimeType || mimeEscolhido || 'audio/webm').split(';')[0]!.trim().toLowerCase()
      const blob = new Blob(gravacaoChunks, { type: blobType || 'audio/webm' })
      gravacaoChunks.length = 0

      if (blob.size < 256) {
        toast.error('Gravação muito curta. Tente de novo.')
        return
      }

      const ext =
        blobType.includes('mp4') || blobType.includes('m4a')
          ? 'm4a'
          : blobType.includes('webm')
            ? 'webm'
            : 'webm'
      const nome = `gravacao-${Date.now()}.${ext}`
      const file = new File([blob], nome, { type: blob.type || 'audio/webm' })
      audioArquivo.value = file
      audioNome.value = nome
      if (audioInputRef.value) audioInputRef.value.value = ''
    }

    mediaRecorderInst = mr
    mr.start(1000)

    gravandoUi.value = true
    elapsedSegundos.value = 0
    limparTimerGravacao()
    intervalId = setInterval(() => {
      elapsedSegundos.value += 1
    }, 1000)
  } catch {
    toast.error('Não foi possível acessar o microfone. Verifique permissões do navegador.')
    encerrarSomenteGravadorMicrofone()
  }
}

watch(tipo, (t) => {
  if (t !== 'audio') encerrarSomenteGravadorMicrofone()
})

onUnmounted(() => {
  abortarMidiaTemporariaNavegador()
  if (audioObjectUrl.value) {
    globalThis.URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = null
  }
})

function resetFormularioVazio() {
  abortarMidiaTemporariaNavegador()
  tipo.value = 'texto'
  titulo.value = ''
  mensagem.value = ''
  dataCampo.value = ''
  horaCampo.value = ''
  destMode.value = 'numeros'
  manualNome.value = ''
  manualTelefone.value = ''
  buscaContato.value = ''
  contatoSelecionado.value = null
  repetirAgendamento.value = false
  frequenciaRecorrencia.value = 'semanal'
  ianaTimezone.value = defaultFusoDoNavegador()
  idCanalSelecionado.value = null
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      abortarMidiaTemporariaNavegador()
      return
    }
    const wid = workspaceIdAtual()

    if (!props.editItem) {
      resetFormularioVazio()
    }
    if (props.prefillDate) {
      dataCampo.value = props.prefillDate
    }
    if (props.editItem) {
      encerrarSomenteGravadorMicrofone()
      const tzRaw = props.editItem.iana_timezone?.trim() ?? ''
      ianaTimezone.value = isIanaFusoBrasilPermitido(tzRaw) ? tzRaw : defaultFusoDoNavegador()
      const partes = dataHoraLocalEmFuso(props.editItem.data_agendada, ianaTimezone.value)
      if (partes) {
        dataCampo.value = partes.data
        horaCampo.value = partes.hora
      } else {
        const d = new Date(props.editItem.data_agendada)
        dataCampo.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        horaCampo.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      const t = (props.editItem.mensagem_type ?? 'texto').trim()
      tipo.value = t === 'imagem' ? 'imagem' : t === 'audio' ? 'audio' : 'texto'
      const texto = props.editItem.mensagem_texto ?? ''
      const parts = texto.split('\n\n')
      titulo.value = tipo.value === 'texto' ? (parts[0] ?? '') : ''
      mensagem.value = tipo.value === 'texto' ? parts.slice(1).join('\n\n') : texto
      imagemNome.value = null
      audioNome.value = null
      imagemArquivo.value = null
      audioArquivo.value = null
      if (props.editItem.usuario_empresa_id != null) {
        destMode.value = 'contatos'
        contatoSelecionado.value = {
          id: props.editItem.usuario_empresa_id,
          nomecliente: props.editItem.nomecliente,
          telefone: props.editItem.telefone,
        }
        manualNome.value = ''
        manualTelefone.value = ''
      } else {
        destMode.value = 'numeros'
        contatoSelecionado.value = null
        manualNome.value = props.editItem.nomecliente ?? ''
        manualTelefone.value = props.editItem.telefone ?? ''
      }
      gravandoUi.value = false
      elapsedSegundos.value = 0
      limparTimerGravacao()
      repetirAgendamento.value = false
      frequenciaRecorrencia.value = 'semanal'
    }

    if (wid != null) {
      try {
        await canaisStore.fetchCanais(wid)
      } catch {
        /* lista opcional; validação ao salvar */
      }
      const it = canaisStore.items
      if (
        props.editItem &&
        typeof props.editItem.id_canal === 'number' &&
        it.some((c) => c.id === props.editItem!.id_canal)
      ) {
        idCanalSelecionado.value = props.editItem.id_canal
      } else if (it.length > 0) {
        const pref = canaisStore.currentCanalId
        idCanalSelecionado.value =
          pref != null && it.some((c) => c.id === pref) ? pref : it[0]!.id
      } else {
        idCanalSelecionado.value = null
      }
    } else {
      idCanalSelecionado.value = null
    }
  },
)

const contatosFiltrados = ref<ContatoDestinoUi[]>([])

watch(
  () => [props.open, destMode.value, buscaContato.value, props.contatosDemonstracao] as const,
  () => {
    if (!props.open || destMode.value !== 'contatos' || contatoSelecionado.value) return
    const q = buscaContato.value.trim().toLowerCase()
    contatosFiltrados.value = props.contatosDemonstracao.filter((c) => {
      if (!q) return true
      const n = (c.nomecliente ?? '').toLowerCase()
      const t = (c.telefone ?? '').toLowerCase()
      return n.includes(q) || t.includes(q)
    })
  },
  { immediate: true },
)

function onImagemChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) {
    input.value = ''
    return
  }
  if (imagemPreviewUrl.value) URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = URL.createObjectURL(f)
  imagemArquivo.value = f
  imagemNome.value = f.name
}

function onAudioChange(e: Event) {
  if (gravandoUi.value) encerrarSomenteGravadorMicrofone()
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!f.type.startsWith('audio/')) {
    input.value = ''
    return
  }
  audioArquivo.value = f
  audioNome.value = f.name
}

function removerImagemAnexada() {
  if (imagemPreviewUrl.value) globalThis.URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = null
  imagemNome.value = null
  imagemArquivo.value = null
  if (imagemInputRef.value) imagemInputRef.value.value = ''
}

function onIdCanalSelectChange(e: Event) {
  const el = e.target as HTMLSelectElement
  idCanalSelecionado.value = el.value === '' ? null : Number.parseInt(el.value, 10)
}

function fechar() {
  abortarMidiaTemporariaNavegador()
  emit('update:open', false)
  emit('cancelar')
}

function montarPayload(): CriarAgendamentoPayloadUi {
  const recorrencia: AgendamentoRecorrenciaUi = repetirAgendamento.value
    ? frequenciaRecorrencia.value
    : 'unico'
  return {
    tipo: tipo.value,
    titulo: titulo.value,
    mensagem: mensagem.value,
    dataIso: dataCampo.value,
    hora: horaCampo.value,
    ianaTimezone: ianaTimezone.value,
    idCanal: idCanalSelecionado.value,
    recorrencia,
    destMode: destMode.value,
    manualNome: manualNome.value,
    manualTelefone: manualTelefone.value,
    contato: contatoSelecionado.value,
    imagemNome: imagemNome.value,
    audioNome: audioNome.value,
  }
}

function mensagemTextoParaApi(p: CriarAgendamentoPayloadUi): string | null {
  if (p.tipo === 'texto') {
    const partes = [p.titulo.trim(), p.mensagem.trim()].filter(Boolean)
    return partes.length ? partes.join('\n\n') : null
  }
  const cap = p.mensagem.trim()
  return cap.length ? cap : null
}

function nomeTelefoneParaApi(p: CriarAgendamentoPayloadUi): { nomecliente: string | null; telefone: string | null } {
  if (p.destMode === 'contatos' && p.contato) {
    const telRaw = p.contato.telefone?.trim() ?? ''
    const tel = telRaw ? normalizeTelefoneBrParaEnvio(telRaw) : ''
    return {
      nomecliente: p.contato.nomecliente?.trim() ? p.contato.nomecliente.trim() : null,
      telefone: tel.length > 0 ? tel : null,
    }
  }
  const manualTelRaw = p.manualTelefone.trim()
  const manualTel = manualTelRaw ? normalizeTelefoneBrParaEnvio(manualTelRaw) : ''
  return {
    nomecliente: p.manualNome.trim() || null,
    telefone: manualTel.length > 0 ? manualTel : null,
  }
}

function mensagemErroFetch(err: unknown): string {
  const o = err as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return o.data?.statusMessage ?? o.statusMessage ?? o.message ?? 'Não foi possível criar o agendamento.'
}

function arquivoParaBase64Payload(arquivo: File): Promise<{ data_base64: string; mime: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result ?? '')
      const mime = (arquivo.type.split(';')[0] ?? '').trim().toLowerCase() || 'application/octet-stream'
      const data_base64 = s.includes('base64,') ? (s.split('base64,')[1] ?? '') : s
      resolve({ data_base64, mime, filename: arquivo.name })
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(arquivo)
  })
}

function workspaceIdAtual(): number | null {
  const raw = (workspacesStore.currentWorkspaceId ?? String(route.params.id ?? '')).trim()
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function validarAntesDeEnviar(p: CriarAgendamentoPayloadUi): string | null {
  const instante = parseDataHoraLocalBrasilParaUtcIso(p.dataIso, p.hora, p.ianaTimezone)
  if (!instante) return 'Informe data e hora válidas no fuso escolhido.'
  if (p.destMode === 'contatos' && !p.contato) return 'Selecione um contato ou use a aba de número manual.'
  if (p.destMode === 'numeros' && !p.manualTelefone.trim()) return 'Informe o telefone do destinatário.'
  const { telefone: telNorm } = nomeTelefoneParaApi(p)
  if (p.destMode === 'numeros' && !telNorm) {
    return 'Telefone inválido. Use DDD e número (com ou sem 55).'
  }
  if (p.destMode === 'contatos' && p.contato && !telNorm) {
    return 'O contato selecionado não tem telefone válido para envio.'
  }
  if (gravandoUi.value) return 'Finalize a gravação (pare o microfone) antes de criar o agendamento.'
  if (p.tipo === 'texto' && !p.titulo.trim() && !p.mensagem.trim()) return 'Preencha título ou mensagem.'
  if (p.tipo === 'imagem' && !imagemArquivo.value) {
    const temMidiaExistente = Boolean(String(props.editItem?.midia_url ?? '').trim())
    if (!temMidiaExistente) return 'Anexe uma imagem.'
  }
  if (p.tipo === 'audio' && !audioArquivo.value) {
    const temMidiaExistente = Boolean(String(props.editItem?.midia_url ?? '').trim())
    if (!temMidiaExistente) return 'Grave um áudio no navegador ou importe um arquivo de áudio.'
  }
  if (!isIanaFusoBrasilPermitido(p.ianaTimezone)) {
    return 'Selecione um fuso horário válido (Brasil).'
  }
  if (p.idCanal == null || !Number.isFinite(p.idCanal) || p.idCanal < 1) {
    return 'Selecione o canal de envio.'
  }
  return null
}

async function salvar() {
  const payload = montarPayload()

  const msgVal = validarAntesDeEnviar(payload)
  if (msgVal) {
    toast.error(msgVal)
    return
  }

  if (props.editItem?.id != null) {
    const wid = workspaceIdAtual()
    if (wid == null) {
      toast.error('Workspace não selecionado. Abra um workspace e tente de novo.')
      return
    }

    submitPending.value = true
    try {
      const { nomecliente, telefone } = nomeTelefoneParaApi(payload)

      let midia_url: string | null = null
      if (payload.tipo === 'imagem' && imagemArquivo.value) {
        const part = await arquivoParaBase64Payload(imagemArquivo.value)
        const up = await $fetch<AgendamentoMidiaUploadResponse>('/api/agendamento-de-mensagem/upload-midia', {
          method: 'POST',
          body: {
            workspace_id: wid,
            mensagem_type: 'imagem',
            mime: part.mime,
            data_base64: part.data_base64,
            filename: part.filename,
          },
        })
        midia_url = up.url
      } else if (payload.tipo === 'imagem') {
        const m = String(props.editItem?.midia_url ?? '').trim()
        midia_url = m.length > 0 ? m : null
      } else if (payload.tipo === 'audio' && audioArquivo.value) {
        const part = await arquivoParaBase64Payload(audioArquivo.value)
        const up = await $fetch<AgendamentoMidiaUploadResponse>('/api/agendamento-de-mensagem/upload-midia', {
          method: 'POST',
          body: {
            workspace_id: wid,
            mensagem_type: 'audio',
            mime: part.mime,
            data_base64: part.data_base64,
            filename: part.filename,
          },
        })
        midia_url = up.url
      } else if (payload.tipo === 'audio') {
        const m = String(props.editItem?.midia_url ?? '').trim()
        midia_url = m.length > 0 ? m : null
      }

      if (payload.tipo === 'imagem' || payload.tipo === 'audio') {
        if (!midia_url?.trim()) {
          toast.error('É necessário manter ou substituir a mídia para este tipo de mensagem.')
          return
        }
      }

      const body: AgendamentoMensagemAtualizarBody = {
        workspace_id: wid,
        id_canal: payload.idCanal!,
        nomecliente,
        telefone,
        mensagem_type: payload.tipo,
        mensagem_texto: mensagemTextoParaApi(payload),
        midia_url,
        data_local: payload.dataIso,
        hora_local: payload.hora,
        iana_timezone: payload.ianaTimezone,
        recorrencia: payload.recorrencia,
      }

      const row = await $fetch<AgendamentoMensagemRow>(`/api/agendamento-de-mensagem/${props.editItem.id}`, {
        method: 'PATCH',
        body,
      })
      toast.success('Agendamento atualizado.')
      emit('update:open', false)
      emit('atualizado', row)
    } catch (err) {
      toast.error(mensagemErroFetch(err))
    } finally {
      submitPending.value = false
    }
    return
  }

  const wid = workspaceIdAtual()
  if (wid == null) {
    toast.error('Workspace não selecionado. Abra um workspace e tente de novo.')
    return
  }

  submitPending.value = true
  try {
    const { nomecliente, telefone } = nomeTelefoneParaApi(payload)

    let midia_url: string | null = null
    if (payload.tipo === 'imagem' && imagemArquivo.value) {
      const part = await arquivoParaBase64Payload(imagemArquivo.value)
      const up = await $fetch<AgendamentoMidiaUploadResponse>('/api/agendamento-de-mensagem/upload-midia', {
        method: 'POST',
        body: {
          workspace_id: wid,
          mensagem_type: 'imagem',
          mime: part.mime,
          data_base64: part.data_base64,
          filename: part.filename,
        },
      })
      midia_url = up.url
    } else if (payload.tipo === 'audio' && audioArquivo.value) {
      const part = await arquivoParaBase64Payload(audioArquivo.value)
      const up = await $fetch<AgendamentoMidiaUploadResponse>('/api/agendamento-de-mensagem/upload-midia', {
        method: 'POST',
        body: {
          workspace_id: wid,
          mensagem_type: 'audio',
          mime: part.mime,
          data_base64: part.data_base64,
          filename: part.filename,
        },
      })
      midia_url = up.url
    }

    const body: AgendamentoMensagemInserirBody = {
      workspace_id: wid,
      id_canal: payload.idCanal!,
      nomecliente,
      telefone,
      mensagem_type: payload.tipo,
      mensagem_texto: mensagemTextoParaApi(payload),
      midia_url,
      data_local: payload.dataIso,
      hora_local: payload.hora,
      iana_timezone: payload.ianaTimezone,
      recorrencia: payload.recorrencia,
    }

    const row = await $fetch<AgendamentoMensagemRow>('/api/agendamento-de-mensagem', {
      method: 'POST',
      body,
    })
    toast.success('Agendamento criado.')
    emit('update:open', false)
    emit('criado', row)
  } catch (err) {
    toast.error(mensagemErroFetch(err))
  } finally {
    submitPending.value = false
  }
}

const modalTitulo = () => (props.editItem?.id != null ? 'Editar agendamento' : props.tituloModal)
</script>

<template>
  <BaseModal
    :open="open"
    :title="modalTitulo()"
    panel-class="w-full max-w-[720px] max-h-[90vh] overflow-y-auto"
    @update:open="emit('update:open', $event)"
    @close="emit('cancelar')"
  >
    <template #subtitle>
      <span class="inline-flex items-center gap-2 rounded-full border border-outline/30 bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant">
        <span class="inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
        Criar e editar gravam no servidor
      </span>
    </template>

    <div class="space-y-4 font-body text-on-surface dark:text-dark-on-surface">
      <div class="space-y-2">
        <p class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Escolha um tipo</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in (
              [
                { id: 'texto', label: 'Criar texto' },
                { id: 'imagem', label: 'Imagem' },
                { id: 'audio', label: 'Áudio' },
              ] as const
            )"
            :key="t.id"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="
              tipo === t.id
                ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-600'
                : 'text-on-surface-variant hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high'
            "
            @click="tipo = t.id"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div v-if="tipo === 'texto'" class="space-y-2">
        <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Título (opcional)</label>
        <input
          v-model="titulo"
          type="text"
          placeholder="Insira aqui o título"
          class="w-full rounded-lg border border-outline/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/50 dark:focus:border-dark-primary dark:focus:ring-dark-primary"
        />
      </div>

      <div
        class="space-y-3 rounded-xl border border-outline/40 bg-surface-container-low p-4 dark:border-dark-outline/40 dark:bg-dark-surface-container"
      >
        <template v-if="tipo === 'texto'">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Mensagem</label>
            <button
              type="button"
              class="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
              aria-label="Emojis (visual)"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
              </svg>
            </button>
          </div>
          <textarea
            v-model="mensagem"
            rows="5"
            placeholder="Insira sua mensagem"
            class="w-full resize-none rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/50 dark:focus:border-dark-primary dark:focus:ring-dark-primary"
          />
        </template>

        <template v-else-if="tipo === 'imagem'">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
            <div class="flex flex-col items-center justify-center gap-2 text-tertiary-accent dark:text-dark-tertiary sm:items-start">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span class="text-sm font-semibold">Importar</span>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Legenda (opcional)
              </label>
              <textarea
                v-model="mensagem"
                rows="4"
                placeholder="Legenda da imagem (opcional)"
                class="w-full resize-none rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
              />
              <input ref="imagemInputRef" type="file" accept="image/*" class="hidden" @change="onImagemChange" />
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <BaseButton variant="secondary" :block="false" @click="imagemInputRef?.click()">
                  <span class="inline-flex items-center gap-2">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    Importar imagem
                  </span>
                </BaseButton>
                <span class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">Somente pré-visualização local</span>
              </div>
              <div
                v-if="imagemPreviewUrl"
                class="mt-2 flex items-start gap-3 rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
              >
                <div class="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-outline/30 dark:border-dark-outline/30">
                  <img :src="imagemPreviewUrl" alt="Prévia" class="h-full w-full object-cover" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ imagemNome }}</p>
                </div>
                <button
                  type="button"
                  class="text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline dark:text-dark-on-surface-variant"
                  @click="removerImagemAnexada"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <p class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Áudio</p>
          <input ref="audioInputRef" type="file" accept="audio/*" class="hidden" @change="onAudioChange" />
          <div class="flex flex-col gap-2">
            <BaseButton variant="info" :disabled="gravandoUi" @click="audioInputRef?.click()">
              <span class="inline-flex items-center gap-2">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                Importar áudio
              </span>
            </BaseButton>
            <BaseButton variant="secondary" :disabled="gravandoUi" @click="audioInputRef?.click()"> Escolher arquivo de áudio </BaseButton>
            <BaseButton variant="secondary" @click="toggleGravacaoAudio">
              <span class="inline-flex items-center gap-2">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                {{ gravandoUi ? 'Parar gravação' : 'Gravar áudio' }}
              </span>
            </BaseButton>
          </div>
          <div
            v-if="gravandoUi"
            class="rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-2 text-sm font-semibold">
                <span class="h-2 w-2 animate-pulse rounded-full bg-danger" />
                Gravando…
              </span>
              <span class="font-mono text-sm tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ String(Math.floor(elapsedSegundos / 60)).padStart(2, '0') }}:{{ String(elapsedSegundos % 60).padStart(2, '0') }}
              </span>
            </div>
            <p class="mt-2 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              O áudio fica só no navegador até você clicar em Criar; ao fechar o modal sem criar, a gravação é descartada.
            </p>
          </div>
          <div
            v-if="audioObjectUrl && !gravandoUi"
            class="mt-2 rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
          >
            <p v-if="audioNome" class="mb-2 text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ audioNome }}
            </p>
            <audio :src="audioObjectUrl" controls class="w-full max-w-full" />
          </div>
        </template>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Data</label>
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <input
              v-model="dataCampo"
              type="date"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-low py-2 pl-10 pr-3 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary"
            />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Hora</label>
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <input
              v-model="horaCampo"
              type="time"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-low py-2 pl-10 pr-3 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:[color-scheme:dark] dark:focus:border-dark-primary dark:focus:ring-dark-primary"
            />
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Fuso horário do agendamento
        </label>
        <p class="text-[11px] leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
          A data e a hora acima são interpretadas neste fuso (lista Brasil).
        </p>
        <select
          v-model="ianaTimezone"
          class="w-full rounded-lg border border-outline/40 bg-surface-container-low py-2.5 px-3 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary"
        >
          <option v-for="op in opcoesFusoBrasil" :key="op.value" :value="op.value">
            {{ op.label }}
          </option>
        </select>
      </div>

      <div
        class="space-y-3 rounded-xl border border-outline/40 bg-surface-container-low p-4 dark:border-dark-outline/40 dark:bg-dark-surface-container"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">Recorrência</p>
            <p class="mt-0.5 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Repetir automaticamente a partir da data e hora acima.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="repetirAgendamento"
            class="flex h-8 w-14 shrink-0 items-center rounded-full border border-outline/50 px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-outline/50 dark:focus-visible:ring-dark-primary"
            :class="repetirAgendamento ? 'justify-end bg-primary-600 dark:bg-primary-600' : 'justify-start bg-surface-container-highest dark:bg-dark-surface-container-highest'"
            @click="repetirAgendamento = !repetirAgendamento"
          >
            <span
              class="pointer-events-none h-7 w-7 rounded-full bg-surface-container-lowest shadow dark:bg-dark-surface-container-low"
              aria-hidden="true"
            />
            <span class="sr-only">{{ repetirAgendamento ? 'Recorrente ativo' : 'Recorrente inativo' }}</span>
          </button>
        </div>

        <div
          v-show="repetirAgendamento"
          class="flex flex-wrap gap-2 border-t border-outline/30 pt-3 dark:border-dark-outline/30"
        >
          <button
            v-for="op in opcoesRecorrencia"
            :key="op.id"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="
              frequenciaRecorrencia === op.id
                ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-600'
                : 'border border-outline/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary-400/50 hover:text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant dark:hover:text-dark-on-surface'
            "
            @click="frequenciaRecorrencia = op.id"
          >
            {{ op.label }}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Canal de envio
        </label>
        <p class="text-[11px] leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
          Escolha o canal WhatsApp deste workspace (sincronizado ao abrir o modal).
        </p>
        <p v-if="canaisStore.listPending" class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Carregando canais…
        </p>
        <select
          v-else
          class="w-full rounded-lg border border-outline/40 bg-surface-container-low py-2.5 px-3 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary"
          :value="idCanalSelecionado == null ? '' : String(idCanalSelecionado)"
          :disabled="!canaisStore.items.length"
          @change="onIdCanalSelectChange"
        >
          <option v-if="!canaisStore.items.length" value="" disabled>Nenhum canal neste workspace</option>
          <option
            v-for="c in canaisStore.items"
            :key="c.id"
            :value="String(c.id)"
          >
            {{ (c.nome ?? '').trim() || `Canal #${c.id}` }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Destinatários</label>
        <div
          class="flex rounded-xl border border-outline/40 bg-surface-container-low p-1 dark:border-dark-outline/40 dark:bg-dark-surface-container"
        >
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="
              destMode === 'contatos'
                ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-600'
                : 'text-on-surface-variant hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high'
            "
            @click="destMode = 'contatos'"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Contatos
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="
              destMode === 'numeros'
                ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-600'
                : 'text-on-surface-variant hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high'
            "
            @click="destMode = 'numeros'"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Número manual
          </button>
        </div>

        <div
          v-if="destMode === 'numeros'"
          class="space-y-3 rounded-xl border border-outline/40 bg-surface-container-lowest p-4 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        >
          <div class="space-y-2">
            <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Nome (opcional)</label>
            <input
              v-model="manualNome"
              type="text"
              placeholder="Ex.: Maria Silva"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-low px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface"
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">Telefone</label>
            <input
              v-model="manualTelefone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+55 11 99999-0000"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-low px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface"
            />
            <p class="text-[11px] leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
              Exemplos: <span class="font-mono text-on-surface dark:text-dark-on-surface">+5511987654321</span> ou
              <span class="font-mono text-on-surface dark:text-dark-on-surface">11987654321</span>.
            </p>
          </div>
        </div>

        <div
          v-else
          class="space-y-3 rounded-xl border border-outline/40 bg-surface-container-lowest p-4 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        >
          <template v-if="contatoSelecionado">
            <div
              class="rounded-lg border border-primary-400/40 bg-primary-50 px-4 py-3 dark:border-dark-primary/40 dark:bg-dark-primary-container/25"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-dark-on-primary-container">
                    Destinatário
                  </p>
                  <p class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                    {{ contatoSelecionado.nomecliente?.trim() || 'Cliente' }}
                  </p>
                  <p class="mt-0.5 truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                    {{ contatoSelecionado.telefone?.trim() || 'Sem telefone' }}
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-outline/40 bg-surface-container-high px-2 py-1 text-xs font-medium text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface"
                  @click="contatoSelecionado = null"
                >
                  Remover
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <input
              v-model="buscaContato"
              type="search"
              placeholder="Filtrar por nome ou telefone..."
              class="w-full rounded-lg border border-outline/40 bg-surface-container-low px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface"
            />
            <div
              class="max-h-40 overflow-y-auto rounded-lg border border-outline/40 bg-surface-container-low dark:border-dark-outline/40 dark:bg-dark-surface-container"
            >
              <button
                v-for="c in contatosFiltrados"
                :key="c.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 border-b border-outline/20 px-3 py-2 text-left last:border-b-0 hover:bg-surface-container-high dark:border-dark-outline/20 dark:hover:bg-dark-surface-container-high"
                @click="contatoSelecionado = c"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-on-surface dark:text-dark-on-surface">{{ c.nomecliente?.trim() || 'Cliente' }}</p>
                  <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">{{ c.telefone }}</p>
                </div>
                <span class="shrink-0 text-[11px] font-semibold text-tertiary-accent dark:text-dark-tertiary">Escolher</span>
              </button>
              <div v-if="contatosFiltrados.length === 0" class="px-3 py-6 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Nenhum contato na lista de demonstração.
              </div>
            </div>
            <p class="text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Lista estática para layout — substitua por dados reais quando integrar.
            </p>
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" :block="false" class="sm:mr-auto" :disabled="submitPending" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton variant="primary" :block="false" :disabled="submitPending" @click="salvar()">
        {{
          submitPending && editItem?.id != null
            ? 'Salvando…'
            : submitPending && editItem?.id == null
              ? 'Criando…'
              : editItem?.id != null
                ? 'Salvar'
                : 'Criar'
        }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
