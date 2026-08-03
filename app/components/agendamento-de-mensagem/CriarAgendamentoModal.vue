<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  AgendamentoMensagemAtualizarBody,
  AgendamentoMensagemInserirBody,
  AgendamentoMensagemRow,
  AgendamentoMidiaUploadResponse,
} from '#shared/types/agendamentoMensagens'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
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
import { useAgendamentosMensagensStore } from '~/stores/agendamentosMensagens'
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
    /** Pré-seleciona destinatário como contato (ex.: chat aberto). */
    prefillContato?: ContatoDestinoUi | null
    /** Pré-seleciona o canal de envio (`canais.id`). */
    prefillCanalId?: number | null
  }>(),
  {
    tituloModal: 'Criar agendamento',
    prefillDate: null,
    prefillContato: null,
    prefillCanalId: null,
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
const agendamentosMensagensStore = useAgendamentosMensagensStore()
const { agendamentoSelecionado, destinatarios, destinatariosHasMore } = storeToRefs(agendamentosMensagensStore)
const route = useRoute()
const submitPending = ref(false)

const tipo = ref<AgendamentoTipoForm>('texto')
const mensagem = ref('')
const dataCampo = ref('')
const horaCampo = ref('')
const ianaTimezone = ref<string>(defaultFusoDoNavegador())

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function partesDeDateLocal(d: Date): { data: string; hora: string } {
  return {
    data: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    hora: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

/** Atalhos rápidos de data/hora (relógio local do navegador → campos do formulário). */
function aplicarAtalhoAgendamento(kind: '1h' | 'hoje_18' | 'amanha_9' | 'semana') {
  const now = new Date()
  let alvo = new Date(now)

  if (kind === '1h') {
    alvo = new Date(now.getTime() + 60 * 60 * 1000)
  } else if (kind === 'hoje_18') {
    alvo.setHours(18, 0, 0, 0)
    if (alvo.getTime() <= now.getTime()) {
      alvo.setDate(alvo.getDate() + 1)
    }
  } else if (kind === 'amanha_9') {
    alvo.setDate(alvo.getDate() + 1)
    alvo.setHours(9, 0, 0, 0)
  } else {
    alvo.setDate(alvo.getDate() + 7)
    alvo.setHours(9, 0, 0, 0)
  }

  const partes = partesDeDateLocal(alvo)
  dataCampo.value = partes.data
  horaCampo.value = partes.hora
}

function sugerirDataHoraPadrao() {
  if (dataCampo.value && horaCampo.value) return
  aplicarAtalhoAgendamento('1h')
}

/** Ex.: "Segunda-feira, 3 de agosto" (estilo do seletor nativo). */
const labelDiaAmigavel = computed(() => {
  const data = dataCampo.value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return ''
  const [y, m, d] = data.split('-').map((x) => Number.parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return ''
  const dt = new Date(y!, (m ?? 1) - 1, d!)
  if (Number.isNaN(dt.getTime())) return ''
  const raw = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
})

const opcoesHora15min = (() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${pad2(h)}:${pad2(m)}`)
    }
  }
  return out
})()

const dateInputRef = ref<HTMLInputElement | null>(null)
const horaDropdownAberto = ref(false)
const horaInputRef = ref<HTMLInputElement | null>(null)

function abrirSeletorDia() {
  const el = dateInputRef.value
  if (!el) return
  try {
    if (typeof el.showPicker === 'function') {
      el.showPicker()
      return
    }
  } catch {
    /* fallback: focus */
  }
  el.focus()
  el.click()
}

function normalizarHoraDigitada(raw: string): string {
  const s = raw.trim().replace(/[hH.]/g, ':')
  const m = /^(\d{1,2}):?(\d{0,2})$/.exec(s)
  if (!m) return raw.trim()
  let hh = Number.parseInt(m[1] ?? '', 10)
  let mm = m[2] ? Number.parseInt(m[2], 10) : 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw.trim()
  hh = Math.min(23, Math.max(0, hh))
  mm = Math.min(59, Math.max(0, mm))
  return `${pad2(hh)}:${pad2(mm)}`
}

function onHoraBlur() {
  horaCampo.value = normalizarHoraDigitada(horaCampo.value)
  // Fecha após um tick para permitir clique na opção.
  globalThis.setTimeout(() => {
    horaDropdownAberto.value = false
  }, 150)
}

function selecionarHoraOpcao(h: string) {
  horaCampo.value = h
  horaDropdownAberto.value = false
}

watch(horaDropdownAberto, (aberto) => {
  if (!aberto) return
  globalThis.requestAnimationFrame(() => {
    const lista = horaInputRef.value?.parentElement?.querySelector('[data-hora-lista]')
    const ativo = lista?.querySelector<HTMLElement>('[data-hora-ativa="true"]')
    ativo?.scrollIntoView({ block: 'nearest' })
  })
})

const atalhosAgendamento = [
  { id: '1h' as const, label: 'Daqui 1 hora', icon: 'schedule' },
  { id: 'hoje_18' as const, label: 'Hoje 18h', icon: 'wb_twilight' },
  { id: 'amanha_9' as const, label: 'Amanhã 9h', icon: 'wb_sunny' },
  { id: 'semana' as const, label: 'Em 7 dias', icon: 'event' },
] as const

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
/** URL já salva no servidor (edição), até substituir por arquivo novo. */
const midiaRemotaUrl = ref<string | null>(null)

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

const audioObjectUrl = ref<string | null>(null)

const hasTextoMensagem = computed(() => Boolean(mensagem.value.trim()))

const previewImagemSrc = computed(
  () => imagemPreviewUrl.value || (tipo.value === 'imagem' ? midiaRemotaUrl.value : null),
)
const previewAudioSrc = computed(
  () => audioObjectUrl.value || (tipo.value === 'audio' ? midiaRemotaUrl.value : null),
)

watch(audioArquivo, (file) => {
  if (audioObjectUrl.value) {
    globalThis.URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = null
  }
  if (file) {
    audioObjectUrl.value = globalThis.URL.createObjectURL(file)
  }
})

function sincronizarTipoPelaMidia() {
  if (imagemArquivo.value || (tipo.value === 'imagem' && midiaRemotaUrl.value)) {
    tipo.value = 'imagem'
    return
  }
  if (audioArquivo.value || (tipo.value === 'audio' && midiaRemotaUrl.value)) {
    tipo.value = 'audio'
    return
  }
  tipo.value = 'texto'
}

/**
 * Fechar modal sem criar (ou backdrop): revoga URLs, apaga arquivos em memória e para o microfone.
 */
function abortarMidiaTemporariaNavegador() {
  cancelRecording()

  if (imagemPreviewUrl.value) globalThis.URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = null
  imagemArquivo.value = null
  imagemNome.value = null
  if (imagemInputRef.value) imagemInputRef.value.value = ''

  audioArquivo.value = null
  audioNome.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
  midiaRemotaUrl.value = null
}

function limparAnexoImagem() {
  if (imagemPreviewUrl.value) globalThis.URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = null
  imagemNome.value = null
  imagemArquivo.value = null
  if (imagemInputRef.value) imagemInputRef.value.value = ''
  if (tipo.value === 'imagem') midiaRemotaUrl.value = null
  sincronizarTipoPelaMidia()
}

function limparAnexoAudio() {
  audioArquivo.value = null
  audioNome.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
  if (tipo.value === 'audio') midiaRemotaUrl.value = null
  sincronizarTipoPelaMidia()
}

async function iniciarGravacaoAudio() {
  if (isRecording.value || hasTextoMensagem.value) return
  limparAnexoImagem()
  limparAnexoAudio()
  await startRecorder()
}

async function confirmarGravacaoAudio() {
  if (!isRecording.value) return
  const audio = await stopAndGetAudio()
  if (!audio) return
  limparAnexoImagem()
  midiaRemotaUrl.value = null
  mensagem.value = ''
  audioArquivo.value = audio.file
  audioNome.value = audio.file.name
  tipo.value = 'audio'
  if (audioInputRef.value) audioInputRef.value.value = ''
}

onUnmounted(() => {
  limparDebounceBuscaContato()
  abortarMidiaTemporariaNavegador()
  if (audioObjectUrl.value) {
    globalThis.URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = null
  }
})

function resetFormularioVazio() {
  abortarMidiaTemporariaNavegador()
  tipo.value = 'texto'
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

function intervaloDbParaRecorrenciaUi(
  intervalo: string | null | undefined,
  rec: boolean | null | undefined,
): { repetir: boolean; freq: Exclude<AgendamentoRecorrenciaUi, 'unico'> } {
  if (rec !== true) return { repetir: false, freq: 'semanal' }
  const s = String(intervalo ?? '').trim().toLowerCase()
  if (s.includes('year')) return { repetir: true, freq: 'anual' }
  if (s.includes('mon')) return { repetir: true, freq: 'mensal' }
  if (s.includes('week') || (s.includes('7') && s.includes('day'))) return { repetir: true, freq: 'semanal' }
  if (s.includes('day')) return { repetir: true, freq: 'diaria' }
  return { repetir: true, freq: 'semanal' }
}

watch(
  () => [props.open, agendamentoSelecionado.value] as const,
  async ([isOpen, item]) => {
    if (!isOpen) {
      abortarMidiaTemporariaNavegador()
      return
    }
    const wid = workspaceIdAtual()

    if (!item) {
      resetFormularioVazio()
      const pref = props.prefillContato
      if (pref?.key?.trim()) {
        destMode.value = 'contatos'
        contatoSelecionado.value = {
          key: pref.key.trim(),
          nomecliente: pref.nomecliente ?? null,
          telefone: pref.telefone ?? null,
          photo: pref.photo ?? null,
        }
      }
      if (props.prefillDate) {
        dataCampo.value = props.prefillDate
        if (!horaCampo.value) {
          const agora = new Date()
          horaCampo.value = `${pad2(agora.getHours())}:${pad2(agora.getMinutes())}`
        }
      } else {
        sugerirDataHoraPadrao()
      }
    }
    if (item) {
      cancelRecording()
      const tzRaw = item.iana_timezone?.trim() ?? ''
      ianaTimezone.value = isIanaFusoBrasilPermitido(tzRaw) ? tzRaw : defaultFusoDoNavegador()
      const partes = dataHoraLocalEmFuso(item.data_agendada, ianaTimezone.value)
      if (partes) {
        dataCampo.value = partes.data
        horaCampo.value = partes.hora
      } else {
        const d = new Date(item.data_agendada)
        dataCampo.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        horaCampo.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      const t = (item.mensagem_type ?? 'texto').trim()
      tipo.value = t === 'imagem' ? 'imagem' : t === 'audio' ? 'audio' : 'texto'
      const texto = item.mensagem_texto ?? ''
      // Áudio é exclusivo — não carrega texto/legenda.
      mensagem.value = tipo.value === 'audio' ? '' : texto
      imagemNome.value = null
      audioNome.value = null
      imagemArquivo.value = null
      audioArquivo.value = null
      midiaRemotaUrl.value = String(item.midia_url ?? '').trim() || null
      if (item.usuario_empresa_id != null) {
        destMode.value = 'contatos'
        contatoSelecionado.value = {
          key: `agendamento:${item.id}`,
          nomecliente: item.nomecliente,
          telefone: item.telefone,
        }
        manualNome.value = ''
        manualTelefone.value = ''
      } else {
        destMode.value = 'numeros'
        contatoSelecionado.value = null
        manualNome.value = item.nomecliente ?? ''
        manualTelefone.value = item.telefone ?? ''
      }
      cancelRecording()
      const recUi = intervaloDbParaRecorrenciaUi(item.intervalo_recorrencia, item.recorrente)
      repetirAgendamento.value = recUi.repetir
      frequenciaRecorrencia.value = recUi.freq
    }

    if (wid != null) {
      try {
        await canaisStore.ensureCanaisLoaded(wid)
      } catch {
        /* lista opcional; validação ao salvar */
      }
      const it = canaisStore.items
      if (
        item &&
        typeof item.id_canal === 'number' &&
        it.some((c) => c.id === item.id_canal)
      ) {
        idCanalSelecionado.value = item.id_canal
      } else if (
        props.prefillCanalId != null &&
        it.some((c) => c.id === props.prefillCanalId)
      ) {
        idCanalSelecionado.value = props.prefillCanalId
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

let debounceBuscaContato: ReturnType<typeof setTimeout> | null = null

function limparDebounceBuscaContato() {
  if (debounceBuscaContato) {
    clearTimeout(debounceBuscaContato)
    debounceBuscaContato = null
  }
}

async function carregarDestinatariosPagina1() {
  if (!props.open || destMode.value !== 'contatos' || contatoSelecionado.value) return

  const wid = workspaceIdAtual()
  const idCanal = idCanalSelecionado.value
  if (wid == null || idCanal == null) {
    agendamentosMensagensStore.resetDestinatarios()
    return
  }

  try {
    await agendamentosMensagensStore.buscarDestinatariosSeNecessario({
      workspaceId: wid,
      idCanal,
      q: buscaContato.value,
    })
  } catch {
    /* erro já em destinatarios.error */
  }
}

watch(
  () =>
    [props.open, destMode.value, idCanalSelecionado.value, contatoSelecionado.value] as const,
  ([open, mode, , selecionado]) => {
    limparDebounceBuscaContato()
    if (!open || mode !== 'contatos') return
    if (selecionado) return
    void carregarDestinatariosPagina1()
  },
  { immediate: true },
)

watch(buscaContato, () => {
  if (!props.open || destMode.value !== 'contatos' || contatoSelecionado.value) return
  limparDebounceBuscaContato()
  debounceBuscaContato = setTimeout(() => {
    debounceBuscaContato = null
    void carregarDestinatariosPagina1()
  }, 350)
})

async function carregarMaisContatos() {
  try {
    await agendamentosMensagensStore.carregarMaisDestinatarios()
  } catch {
    /* erro já em destinatarios.error */
  }
}

function onImagemChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) {
    input.value = ''
    return
  }
  cancelRecording()
  limparAnexoAudio()
  if (imagemPreviewUrl.value) URL.revokeObjectURL(imagemPreviewUrl.value)
  imagemPreviewUrl.value = URL.createObjectURL(f)
  imagemArquivo.value = f
  imagemNome.value = f.name
  midiaRemotaUrl.value = null
  tipo.value = 'imagem'
}

function onAudioChange(e: Event) {
  cancelRecording()
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!f.type.startsWith('audio/')) {
    input.value = ''
    toast.error('Selecione um arquivo de áudio.')
    return
  }
  limparAnexoImagem()
  mensagem.value = ''
  audioArquivo.value = f
  audioNome.value = f.name
  midiaRemotaUrl.value = null
  tipo.value = 'audio'
}

function removerImagemAnexada() {
  limparAnexoImagem()
}

function abrirAnexoDispositivo(kind: 'imagem' | 'audio') {
  if (kind === 'imagem') imagemInputRef.value?.click()
  else audioInputRef.value?.click()
}

function onIdCanalSelectChange(e: Event) {
  const el = e.target as HTMLSelectElement
  idCanalSelecionado.value = el.value === '' ? null : Number.parseInt(el.value, 10)
  if (destMode.value === 'contatos' && !contatoSelecionado.value) {
    void carregarDestinatariosPagina1()
  }
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
  // Áudio é exclusivo — sem legenda/texto junto.
  if (p.tipo === 'audio') return null
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
  if (isRecording.value) return 'Finalize a gravação antes de criar o agendamento.'
  if (p.tipo === 'texto' && !p.mensagem.trim()) return 'Preencha a mensagem.'
  if (p.tipo === 'imagem' && !imagemArquivo.value) {
    const temMidiaExistente = Boolean(String(midiaRemotaUrl.value ?? '').trim())
    if (!temMidiaExistente) return 'Anexe uma imagem.'
  }
  if (p.tipo === 'audio' && !audioArquivo.value) {
    const temMidiaExistente = Boolean(String(midiaRemotaUrl.value ?? '').trim())
    if (!temMidiaExistente) return 'Grave um áudio ou importe um arquivo de áudio.'
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

  if (agendamentoSelecionado.value?.id != null) {
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
        const m = String(midiaRemotaUrl.value ?? '').trim()
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
        const m = String(midiaRemotaUrl.value ?? '').trim()
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

      const row = await $fetch<AgendamentoMensagemRow>(`/api/agendamento-de-mensagem/${agendamentoSelecionado.value!.id}`, {
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

const modalTitulo = () => (agendamentoSelecionado.value?.id != null ? 'Editar agendamento' : props.tituloModal)
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
      <div
        class="space-y-4 rounded-2xl border border-outline/30 bg-surface-container-low/80 p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container/60"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[22px]">event_available</span>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Quando enviar?
            </p>
            <p class="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
              Escolha um atalho ou defina data e hora manualmente.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="atalho in atalhosAgendamento"
            :key="atalho.id"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-outline/35 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-dark-outline/35 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:border-primary/40 dark:hover:bg-primary/10"
            @click="aplicarAtalhoAgendamento(atalho.id)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ atalho.icon }}</span>
            {{ atalho.label }}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Dia: label amigável + calendário nativo -->
          <div class="relative space-y-1.5">
            <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Dia
            </span>
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-3 text-left text-sm font-medium text-on-surface shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
              @click="abrirSeletorDia"
            >
              <span class="min-w-0 truncate">
                {{ labelDiaAmigavel || 'Escolher dia' }}
              </span>
              <span class="material-symbols-outlined shrink-0 text-[20px] text-on-surface-variant" aria-hidden="true">
                calendar_month
              </span>
            </button>
            <input
              ref="dateInputRef"
              v-model="dataCampo"
              type="date"
              class="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>

          <!-- Hora: digitar + lista 15 em 15 -->
          <div class="relative space-y-1.5">
            <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Horário
            </span>
            <div class="relative">
              <input
                ref="horaInputRef"
                v-model="horaCampo"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="13:30"
                class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-3 pr-10 text-sm font-medium tabular-nums text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
                @focus="horaDropdownAberto = true"
                @click="horaDropdownAberto = true"
                @blur="onHoraBlur"
                @keydown.enter.prevent="horaCampo = normalizarHoraDigitada(horaCampo); horaDropdownAberto = false"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
                tabindex="-1"
                aria-label="Abrir horários"
                @mousedown.prevent="horaDropdownAberto = !horaDropdownAberto"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">schedule</span>
              </button>
              <div
                v-if="horaDropdownAberto"
                data-hora-lista
                class="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline/40 bg-surface-container-lowest py-1 shadow-lg dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
              >
                <button
                  v-for="h in opcoesHora15min"
                  :key="h"
                  type="button"
                  :data-hora-ativa="horaCampo === h ? 'true' : undefined"
                  class="flex w-full px-3 py-2 text-left text-sm tabular-nums transition hover:bg-primary/10"
                  :class="
                    horaCampo === h
                      ? 'bg-primary/15 font-semibold text-primary'
                      : 'text-on-surface dark:text-dark-on-surface'
                  "
                  @mousedown.prevent="selecionarHoraOpcao(h)"
                >
                  {{ h }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
            Fuso horário
          </span>
          <select
            v-model="ianaTimezone"
            class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest py-3 px-3 text-sm font-medium text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          >
            <option v-for="op in opcoesFusoBrasil" :key="op.value" :value="op.value">
              {{ op.label }}
            </option>
          </select>
        </label>
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
            <p
              v-if="idCanalSelecionado == null"
              class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Selecione um canal de envio acima para listar os contatos.
            </p>
            <template v-else>
              <input
                v-model="buscaContato"
                type="search"
                placeholder="Buscar por nome ou telefone..."
                class="w-full rounded-lg border border-outline/40 bg-surface-container-low px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface"
              />
              <div
                class="max-h-40 overflow-y-auto rounded-lg border border-outline/40 bg-surface-container-low dark:border-dark-outline/40 dark:bg-dark-surface-container"
              >
                <div
                  v-if="destinatarios.loading && destinatarios.items.length === 0"
                  class="px-3 py-6 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Carregando contatos…
                </div>
                <div
                  v-else-if="destinatarios.error"
                  class="px-3 py-6 text-center text-xs text-error dark:text-dark-error"
                >
                  {{ destinatarios.error }}
                </div>
                <template v-else>
                  <button
                    v-for="c in destinatarios.items"
                    :key="c.key"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 border-b border-outline/20 px-3 py-2 text-left last:border-b-0 hover:bg-surface-container-high dark:border-dark-outline/20 dark:hover:bg-dark-surface-container-high"
                    @click="contatoSelecionado = c"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm text-on-surface dark:text-dark-on-surface">{{ c.nomecliente?.trim() || 'Cliente' }}</p>
                      <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">{{ c.telefone?.trim() || 'Sem telefone' }}</p>
                    </div>
                    <span class="shrink-0 text-[11px] font-semibold text-tertiary-accent dark:text-dark-tertiary">Escolher</span>
                  </button>
                  <div
                    v-if="destinatarios.items.length === 0"
                    class="px-3 py-6 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Nenhum contato encontrado.
                  </div>
                </template>
              </div>
              <button
                v-if="destinatariosHasMore && !destinatarios.loading"
                type="button"
                class="w-full rounded-lg border border-outline/40 bg-surface-container-high px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                :disabled="destinatarios.loadingMore"
                @click="carregarMaisContatos()"
              >
                {{ destinatarios.loadingMore ? 'Carregando…' : 'Carregar mais contatos' }}
              </button>
            </template>
          </template>
        </div>
      </div>

      <div class="space-y-3">
        <p class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Mensagem
        </p>

        <div
          v-if="previewImagemSrc"
          class="flex items-start gap-3 rounded-xl border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        >
          <div class="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-outline/30 dark:border-dark-outline/30">
            <img :src="previewImagemSrc" alt="Prévia" class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ imagemNome || 'Imagem anexada' }}</p>
            <p class="mt-0.5 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Você pode adicionar uma legenda no campo abaixo.
            </p>
          </div>
          <button
            type="button"
            class="text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline dark:text-dark-on-surface-variant"
            @click="removerImagemAnexada"
          >
            Remover
          </button>
        </div>

        <input
          ref="imagemInputRef"
          class="hidden"
          type="file"
          accept="image/*"
          @change="onImagemChange"
        />
        <input
          ref="audioInputRef"
          class="hidden"
          type="file"
          accept="audio/*"
          @change="onAudioChange"
        />

        <!-- Áudio exclusivo: sem campo de texto; dá para trocar via + (imagem) ou Remover -->
        <div
          v-if="previewAudioSrc && !isRecording"
          class="rounded-xl border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        >
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p class="truncate text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ audioNome || 'Áudio anexado' }}
            </p>
            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="rounded-lg border border-outline/40 px-2 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high dark:border-dark-outline/40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                @click="abrirAnexoDispositivo('imagem')"
              >
                Trocar por imagem
              </button>
              <button
                type="button"
                class="text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline dark:text-dark-on-surface-variant"
                @click="limparAnexoAudio"
              >
                Remover
              </button>
            </div>
          </div>
          <audio :src="previewAudioSrc" controls class="w-full max-w-full" />
          <p class="mt-2 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
            Áudio não combina com texto. Remova o áudio para escrever uma mensagem, ou troque por uma imagem (com legenda opcional).
          </p>
        </div>

        <div
          v-else
          class="flex w-full min-w-0 items-end gap-2 sm:gap-3"
        >
          <div class="shrink-0">
            <BaseDropdown
              title="Anexar mídia"
              align="left"
              side="top"
              teleport
              panel-class="w-60 min-w-[14rem]"
            >
              <template #trigger>
                <span
                  class="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Anexar mídia"
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
                    @click="() => { close(); abrirAnexoDispositivo('imagem') }"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">image</span>
                    Enviar imagem
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                    @click="() => { close(); abrirAnexoDispositivo('audio') }"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">audio_file</span>
                    Enviar áudio do dispositivo
                  </button>
                </div>
              </template>
            </BaseDropdown>
          </div>

          <div class="min-w-0 flex-1">
            <div
              v-if="isRecording"
              class="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 dark:bg-slate-800"
            >
              <span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
              <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ isPaused ? 'Pausado' : 'Gravando…' }}
              </span>
              <span class="ml-auto shrink-0 font-mono text-sm tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ formatRecordTime(recordSeconds) }}
              </span>
            </div>
            <textarea
              v-else
              v-model="mensagem"
              name="mensagem-agendamento"
              rows="2"
              :placeholder="previewImagemSrc ? 'Legenda (opcional)…' : 'Escreva sua mensagem…'"
              autocomplete="off"
              class="box-border max-h-36 min-h-12 w-full resize-y rounded-2xl border-0 bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface shadow-none outline-none placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-primary dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-400"
            />
          </div>

          <div class="flex shrink-0 items-center gap-2 self-end">
            <template v-if="isRecording">
              <button
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-95 sm:h-12 sm:w-12 dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                aria-label="Cancelar gravação"
                @click="cancelRecording"
              >
                <span class="material-symbols-outlined" aria-hidden="true">delete</span>
              </button>
              <button
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 sm:h-12 sm:w-12 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                :aria-label="isPaused ? 'Continuar gravação' : 'Pausar gravação'"
                @click="togglePauseRecording"
              >
                <span class="material-symbols-outlined" aria-hidden="true">
                  {{ isPaused ? 'play_arrow' : 'pause' }}
                </span>
              </button>
              <button
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
                aria-label="Confirmar áudio"
                @click="confirmarGravacaoAudio"
              >
                <span class="material-symbols-outlined" aria-hidden="true">check</span>
              </button>
            </template>
            <button
              v-else-if="!hasTextoMensagem && !previewImagemSrc"
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
              aria-label="Gravar áudio"
              @click="iniciarGravacaoAudio"
            >
              <span class="material-symbols-outlined" aria-hidden="true">mic</span>
            </button>
          </div>
        </div>
      </div>

    </div>

    <template #footer>
      <BaseButton variant="secondary" :block="false" class="sm:mr-auto" :disabled="submitPending" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton variant="primary" :block="false" :disabled="submitPending" @click="salvar()">
        {{
          submitPending && agendamentoSelecionado?.id != null
            ? 'Salvando…'
            : submitPending && agendamentoSelecionado?.id == null
              ? 'Criando…'
              : agendamentoSelecionado?.id != null
                ? 'Salvar'
                : 'Criar'
        }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
