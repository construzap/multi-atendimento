<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { CampanhaStatusCriacao, CampanhaListItem, CriarCampanhaResponse, AtualizarCampanhaResponse, EnfileirarFilaDisparoResponse } from '#shared/types/disparoEmMassa'
import { OPCOES_FUSO_CAMPANHA, defaultFusoCampanhaDoNavegador, normalizarTimezoneCampanhaParaFormulario } from '#shared/constants/ianaTimezonesBrasil'
import BaseButton from '~/components/BaseButton.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import { useCanaisStore } from '~/stores/canais'
import { useDisparoEmMassaStore } from '~/stores/disparoEmMassa'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'

export type CampanhaTipoMensagem = 'texto' | 'imagem' | 'audio'
export type CampanhaFiltroDestinatario = 'coluna'

const props = withDefaults(
  defineProps<{
    titulo?: string
    /** Se informado, preenche o formulário com dados do Pinia (modo edição). */
    campanhaId?: string | null
  }>(),
  {
    titulo: 'Criar campanha',
    campanhaId: null,
  },
)

const emit = defineEmits<{
  criado: [response: CriarCampanhaResponse]
  atualizado: [response: AtualizarCampanhaResponse]
  cancelar: []
}>()

const kanban = useKanbanStore()
const canaisStore = useCanaisStore()
const disparoEmMassa = useDisparoEmMassaStore()
const workspacesStore = useWorkspacesStore()
const route = useRoute()
const { funis, funisPending, funisError } = storeToRefs(kanban)
const { campanhas } = storeToRefs(disparoEmMassa)

const totalColunasFunis = computed(() =>
  funis.value.reduce((acc, funil) => acc + funil.columns.length, 0),
)

const funisComColunas = computed(() => funis.value.filter((funil) => funil.columns.length > 0))

/** Funis ordenados com o funil «mover após disparo» primeiro (modo edição). */
const funisComColunasAposDisparo = computed(() => {
  const lista = [...funisComColunas.value]
  const fid = funilIdAposDisparo.value
  if (fid == null) return lista
  return lista.sort((a, b) => {
    if (a.id === fid) return -1
    if (b.id === fid) return 1
    return a.ordem - b.ordem
  })
})

/** Funis ordenados com o funil «erro no disparo» primeiro (modo edição). */
const funisComColunasErro = computed(() => {
  const lista = [...funisComColunas.value]
  const fid = funilErroId.value
  if (fid == null) return lista
  return lista.sort((a, b) => {
    if (a.id === fid) return -1
    if (b.id === fid) return 1
    return a.ordem - b.ordem
  })
})

const modoEdicao = computed(() => Boolean(props.campanhaId?.trim()))
const tituloExibicao = computed(() =>
  modoEdicao.value ? 'Editar campanha' : props.titulo,
)

const TOTAL_ETAPAS = 8
const etapaAtual = ref(0)
const ehPrimeiraEtapa = computed(() => etapaAtual.value === 0)
const ehUltimaEtapa = computed(() => etapaAtual.value === TOTAL_ETAPAS - 1)
const rotuloEtapa = computed(() => `Etapa ${etapaAtual.value + 1} de ${TOTAL_ETAPAS}`)
const rotuloBotaoSalvar = computed(() => {
  if (submitPending.value) return modoEdicao.value ? 'Salvando…' : 'Criando campanha…'
  return modoEdicao.value ? 'Salvar' : 'Criar campanha'
})

function irProximaEtapa() {
  if (etapaAtual.value < TOTAL_ETAPAS - 1) etapaAtual.value += 1
}

function irEtapaAnterior() {
  if (etapaAtual.value > 0) etapaAtual.value -= 1
}

function workspaceIdAtual(): number | null {
  const raw = (workspacesStore.currentWorkspaceId ?? String(route.params.id ?? '')).trim()
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

const nomeCampanha = ref('')
const statusCampanha = ref<CampanhaStatusCriacao>('processando')
const iaLigada = ref(true)
const tipo = ref<CampanhaTipoMensagem>('texto')
const mensagem = ref('')
const visualizacaoUnica = ref(false)
const dataCampo = ref('')
const horaCampo = ref('')
const ianaTimezone = ref<string>(defaultFusoCampanhaDoNavegador())
const opcoesFusoBrasil = OPCOES_FUSO_CAMPANHA
const horaPermitidaInicio = ref('08:00')
const horaPermitidaFim = ref('18:00')
const intervaloMinimo = ref(30)
const intervaloMaximo = ref(60)
const tamanhoLote = ref(10)
const pausaLoteMinutos = ref(30)
const canaisSelecionados = ref<number[]>([])
const filtroDestinatario = ref<CampanhaFiltroDestinatario>('coluna')
const colunasSelecionadas = ref<number[]>([])
const fonteCanaisSelecionados = ref<number[]>([])
const enviaParaGrupo = ref(false)
/** Coluna do funil para mover o contato após o disparo (`null` = não mover). */
const colunaAposDisparoId = ref<number | null>(null)
/** Funil da coluna «mover após o disparo» (`campanhas.funil_id`). */
const funilIdAposDisparo = ref<number | null>(null)
/** Coluna do funil para mover o contato se o envio falhar. */
const colunaErroId = ref<number | null>(null)
/** Funil da coluna de erro (`campanhas.funil_erro_id`). */
const funilErroId = ref<number | null>(null)
const submitPending = ref(false)

const FILA_LOTE = 10
const progressoAberto = ref(false)
const progressoTitulo = ref('Criando campanha…')
const progressoEtapa = ref('Etapa 1 de 2: Criando campanha…')
const progressoTotal = ref(0)
const progressoEnviados = ref(0)
const progressoErro = ref<string | null>(null)
let abortController: AbortController | null = null

const statusOpcoes = [
  { id: 'rascunho' as const, label: 'Rascunho', icon: 'draft' },
  { id: 'processando' as const, label: 'Processando', icon: 'play_circle' },
]

const iaOpcoes = [
  { value: true, label: 'Ligada', icon: 'smart_toy' },
  { value: false, label: 'Desligada', icon: 'power_off' },
] as const

const tiposOpcoes = [
  { id: 'texto' as const, label: 'Texto', icon: 'chat' },
  { id: 'imagem' as const, label: 'Imagem', icon: 'image' },
  { id: 'audio' as const, label: 'Áudio', icon: 'mic' },
] as const

const variaveisMensagem = [
  {
    id: 'saudacao',
    label: 'Saudação',
    hint: 'Bom dia, Boa tarde ou Boa noite',
  },
  {
    id: 'primeiro_nome',
    label: 'Primeiro nome',
    hint: 'Primeiro nome do cliente (ex.: João de "João Silva")',
  },
  {
    id: 'data_atual',
    label: 'Data atual',
    hint: 'Data de hoje formatada (ex.: 08/07/2026)',
  },
] as const

const labelCls =
  'text-xs font-semibold tracking-wide text-on-surface dark:text-dark-on-surface'
const hintCls =
  'text-[11px] leading-relaxed text-on-surface-variant/90 dark:text-dark-on-surface-variant'
const inputCls =
  'w-full rounded-xl border border-outline/45 bg-surface-container-lowest/90 px-3.5 py-2.5 text-sm font-medium text-on-surface shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 placeholder:font-normal placeholder:text-on-surface-variant/55 hover:border-primary-400/45 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:shadow-[0_4px_12px_rgba(37,99,235,0.12)] dark:border-dark-outline/45 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/55 dark:hover:border-dark-primary/40 dark:focus:border-dark-primary dark:focus:ring-dark-primary/25'
const sectionCls =
  'rounded-2xl border border-outline/25 bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-primary-50/20 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-[2px] dark:border-dark-outline/20 dark:from-dark-surface-container-low dark:via-dark-surface-container dark:to-primary-950/20 dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)]'
const secaoIconCls =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner'

function parseFonteCanaisIdsCsv(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return []
  const ids: number[] = []
  for (const part of raw.split(',')) {
    const n = Number.parseInt(part.trim(), 10)
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) ids.push(n)
  }
  return [...new Set(ids)]
}

function classeSegmento(ativo: boolean, compacto = false) {
  const base = [
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-2',
    'dark:focus-visible:ring-dark-primary/35 active:scale-[0.98]',
    compacto ? 'min-h-[36px] px-3 py-1.5 text-xs' : 'min-h-[40px] px-4 py-2 text-sm',
  ].join(' ')
  if (ativo) {
    return [
      base,
      'bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 text-white',
      'shadow-[0_4px_14px_rgba(37,99,235,0.32)] hover:brightness-105 hover:shadow-[0_6px_20px_rgba(37,99,235,0.38)]',
      'dark:from-primary-500 dark:via-primary-600 dark:to-indigo-600',
    ].join(' ')
  }
  return [
    base,
    'border border-outline/40 bg-surface/80 text-on-surface-variant shadow-sm',
    'hover:border-primary-300/50 hover:bg-surface-container-high hover:text-on-surface hover:shadow-md',
    'dark:border-dark-outline/40 dark:bg-dark-surface-container-high/70 dark:text-dark-on-surface-variant',
    'dark:hover:border-dark-primary/35 dark:hover:text-dark-on-surface',
  ].join(' ')
}

function classeChipAcao() {
  return [
    'inline-flex min-h-[32px] items-center rounded-lg border border-outline/40 bg-surface-container-high/80 px-3 py-1.5',
    'text-xs font-semibold text-on-surface shadow-sm transition-all duration-200',
    'hover:border-primary-300/50 hover:bg-surface-container-high hover:shadow-md',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
    'dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface',
    'dark:hover:border-dark-primary/35',
  ].join(' ')
}

function inserirVariavelMensagem(variavelId: string) {
  const token = `{{${variavelId}}}`
  const el = mensagemTextareaRef.value
  if (!el) {
    mensagem.value += token
    return
  }
  const start = el.selectionStart ?? mensagem.value.length
  const end = el.selectionEnd ?? start
  mensagem.value = mensagem.value.slice(0, start) + token + mensagem.value.slice(end)
  void nextTick(() => {
    el.focus()
    const pos = start + token.length
    el.setSelectionRange(pos, pos)
  })
}

function rotuloVariavelMensagem(variavelId: string) {
  return `{{${variavelId}}}`
}

function classeColunaItem(selecionada: boolean) {
  const base = [
    'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3',
    'transition-all duration-200 focus-within:ring-2 focus-within:ring-primary-500/25',
    'dark:focus-within:ring-dark-primary/25',
  ].join(' ')
  if (selecionada) {
    return [
      base,
      'border-primary-400/55 bg-gradient-to-r from-primary-50/90 to-indigo-50/50 shadow-[0_2px_10px_rgba(37,99,235,0.12)]',
      'dark:border-dark-primary/45 dark:from-dark-primary-container/25 dark:to-indigo-950/30',
    ].join(' ')
  }
  return [
    base,
    'border-outline/30 bg-surface-container-lowest/80 hover:border-outline/50 hover:bg-surface-container-high hover:shadow-sm',
    'dark:border-dark-outline/30 dark:bg-dark-surface-container dark:hover:bg-dark-surface-container-high',
  ].join(' ')
}

const imagemInputRef = ref<HTMLInputElement | null>(null)
const audioInputRef = ref<HTMLInputElement | null>(null)
const mensagemTextareaRef = ref<HTMLTextAreaElement | null>(null)
const imagemNome = ref<string | null>(null)
const audioNome = ref<string | null>(null)
const imagemArquivo = ref<File | null>(null)
const audioArquivo = ref<File | null>(null)
const imagemPreviewUrl = ref<string | null>(null)

const gravandoUi = ref(false)
const gravacaoPausada = ref(false)
const elapsedSegundos = ref(0)
let intervalId: ReturnType<typeof setInterval> | null = null
let descartarGravacaoAoParar = false

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
  gravacaoPausada.value = false
  elapsedSegundos.value = 0
  descartarGravacaoAoParar = false
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

function iniciarTimerGravacao() {
  limparTimerGravacao()
  intervalId = setInterval(() => {
    elapsedSegundos.value += 1
  }, 1000)
}

function finalizarGravacaoNoStop(mr: MediaRecorder, mimeEscolhido: string) {
  pararTracksGravacao()
  limparTimerGravacao()
  gravandoUi.value = false
  gravacaoPausada.value = false
  elapsedSegundos.value = 0
  mediaRecorderInst = null

  const descartar = descartarGravacaoAoParar
  descartarGravacaoAoParar = false

  if (descartar) {
    gravacaoChunks.length = 0
    return
  }

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

function pararTracksGravacao() {
  gravacaoStreamRef?.getTracks().forEach((t) => t.stop())
  gravacaoStreamRef = null
}

function revogarObjectUrlSeBlob(url: string | null) {
  if (url?.startsWith('blob:')) {
    globalThis.URL.revokeObjectURL(url)
  }
}

function abortarMidiaTemporariaNavegador() {
  encerrarSomenteGravadorMicrofone()

  revogarObjectUrlSeBlob(imagemPreviewUrl.value)
  imagemPreviewUrl.value = null
  imagemArquivo.value = null
  imagemNome.value = null
  if (imagemInputRef.value) imagemInputRef.value.value = ''

  audioArquivo.value = null
  audioNome.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
}

async function toggleGravacaoAudio() {
  if (gravandoUi.value) return

  if (!import.meta.client) return

  gravacaoChunks.length = 0
  descartarGravacaoAoParar = false
  gravacaoPausada.value = false

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
      finalizarGravacaoNoStop(mr, mimeEscolhido)
    }

    mediaRecorderInst = mr
    mr.start(1000)

    gravandoUi.value = true
    elapsedSegundos.value = 0
    iniciarTimerGravacao()
  } catch {
    toast.error('Não foi possível acessar o microfone. Verifique permissões do navegador.')
    encerrarSomenteGravadorMicrofone()
  }
}

function togglePausaGravacao() {
  if (!mediaRecorderInst || !gravandoUi.value) return
  if (mediaRecorderInst.state === 'recording') {
    mediaRecorderInst.pause()
    gravacaoPausada.value = true
    limparTimerGravacao()
    return
  }
  if (mediaRecorderInst.state === 'paused') {
    mediaRecorderInst.resume()
    gravacaoPausada.value = false
    iniciarTimerGravacao()
  }
}

function finalizarGravacaoAudio() {
  if (!gravandoUi.value || !mediaRecorderInst) return
  descartarGravacaoAoParar = false
  if (mediaRecorderInst.state === 'recording' || mediaRecorderInst.state === 'paused') {
    mediaRecorderInst.stop()
  }
}

function cancelarGravacaoAudio() {
  if (!gravandoUi.value) return
  descartarGravacaoAoParar = true
  if (mediaRecorderInst?.state === 'recording' || mediaRecorderInst?.state === 'paused') {
    mediaRecorderInst.stop()
    return
  }
  encerrarSomenteGravadorMicrofone()
}

function removerAudioAnexado() {
  if (gravandoUi.value) encerrarSomenteGravadorMicrofone()
  audioArquivo.value = null
  audioNome.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
}

watch(tipo, (t) => {
  if (t !== 'audio') encerrarSomenteGravadorMicrofone()
  if (t === 'texto') visualizacaoUnica.value = false
})

onUnmounted(() => {
  abortarMidiaTemporariaNavegador()
  if (audioObjectUrl.value) {
    globalThis.URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = null
  }
})

function resetFormulario() {
  abortarMidiaTemporariaNavegador()
  nomeCampanha.value = ''
  statusCampanha.value = 'processando'
  iaLigada.value = true
  tipo.value = 'texto'
  mensagem.value = ''
  visualizacaoUnica.value = false
  dataCampo.value = ''
  horaCampo.value = ''
  ianaTimezone.value = defaultFusoCampanhaDoNavegador()
  horaPermitidaInicio.value = '08:00'
  horaPermitidaFim.value = '18:00'
  intervaloMinimo.value = 30
  intervaloMaximo.value = 60
  tamanhoLote.value = 10
  pausaLoteMinutos.value = 30
  canaisSelecionados.value = []
  filtroDestinatario.value = 'coluna'
  colunasSelecionadas.value = []
  fonteCanaisSelecionados.value = []
  enviaParaGrupo.value = false
  colunaAposDisparoId.value = null
  funilIdAposDisparo.value = null
  colunaErroId.value = null
  funilErroId.value = null
  imagemNome.value = null
  audioNome.value = null
}

function horaBancoParaInput(hora: string | null | undefined): string {
  if (!hora) return '08:00'
  const match = /^(\d{1,2}):(\d{2})/.exec(hora.trim())
  if (!match?.[1] || !match[2]) return '08:00'
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function isoParaCamposLocais(
  iso: string | null | undefined,
  timeZone?: string | null,
): { data: string; hora: string } {
  if (!iso) return { data: '', hora: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { data: '', hora: '' }

  const tz = timeZone?.trim() || undefined
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const parts = fmt.formatToParts(d)
      const pick = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''
      const data = `${pick('year')}-${pick('month')}-${pick('day')}`
      const hora = `${pick('hour')}:${pick('minute')}`
      if (/^\d{4}-\d{2}-\d{2}$/.test(data) && /^\d{2}:\d{2}$/.test(hora)) {
        return { data, hora }
      }
    } catch {
      /* fallback local */
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function parseFunilIdCampanha(raw: string | null | undefined): number | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function aplicarMoverAposDisparoDoPinia(campanha: CampanhaListItem) {
  colunaAposDisparoId.value = campanha.coluna_id ?? null
  funilIdAposDisparo.value = parseFunilIdCampanha(campanha.funil_id)

  if (colunaAposDisparoId.value != null) {
    const fidColuna = funilIdDaColuna(colunaAposDisparoId.value)
    if (fidColuna != null) funilIdAposDisparo.value = fidColuna
  }
}

function aplicarColunaErroDoPinia(campanha: CampanhaListItem) {
  colunaErroId.value = campanha.coluna_erro_id ?? null
  funilErroId.value = parseFunilIdCampanha(campanha.funil_erro_id)

  if (colunaErroId.value != null) {
    const fidColuna = funilIdDaColuna(colunaErroId.value)
    if (fidColuna != null) funilErroId.value = fidColuna
  }
}

function inferirTipoMensagem(campanha: CampanhaListItem): CampanhaTipoMensagem {
  if (campanha.url_midia) {
    const u = campanha.url_midia.toLowerCase()
    if (/\.(mp3|ogg|wav|m4a|aac|opus|weba?)(\?|$)/.test(u)) return 'audio'
    return 'imagem'
  }
  return 'texto'
}

function normalizarStatusEdicao(status: CampanhaListItem['status']): CampanhaStatusCriacao {
  if (status === 'rascunho' || status === 'processando') return status
  return 'rascunho'
}

function preencherFormulario(campanha: CampanhaListItem) {
  abortarMidiaTemporariaNavegador()
  if (audioObjectUrl.value) {
    revogarObjectUrlSeBlob(audioObjectUrl.value)
    audioObjectUrl.value = null
  }

  nomeCampanha.value = campanha.nome
  statusCampanha.value = normalizarStatusEdicao(campanha.status)
  iaLigada.value = campanha.ia_ligada ?? true
  tipo.value = inferirTipoMensagem(campanha)
  mensagem.value = campanha.conteudo_texto ?? ''
  visualizacaoUnica.value = campanha.visualizacao_unica ?? false

  ianaTimezone.value = normalizarTimezoneCampanhaParaFormulario(campanha.timezone_escolhido)
  const { data, hora } = isoParaCamposLocais(campanha.data_inicio, ianaTimezone.value)
  dataCampo.value = data
  horaCampo.value = hora
  horaPermitidaInicio.value = horaBancoParaInput(campanha.hora_permitida_inicio)
  horaPermitidaFim.value = horaBancoParaInput(campanha.hora_permitida_fim)
  intervaloMinimo.value = campanha.intervalo_minimo_minutos ?? 30
  intervaloMaximo.value = campanha.intervalo_maximo_minutos ?? 60
  tamanhoLote.value = campanha.tamanho_lote ?? 10
  pausaLoteMinutos.value = campanha.pausa_lote_minutos ?? 30
  const idsCanais =
    campanha.canais_ids?.filter((id) => Number.isFinite(id) && id > 0) ??
    (campanha.canal_id != null ? [campanha.canal_id] : [])
  canaisSelecionados.value = [...new Set(idsCanais)]
  fonteCanaisSelecionados.value = parseFonteCanaisIdsCsv(campanha.fonte_canal_id)
  enviaParaGrupo.value = campanha.envia_para_grupo === true
  colunasSelecionadas.value = []
  aplicarMoverAposDisparoDoPinia(campanha)
  aplicarColunaErroDoPinia(campanha)

  imagemArquivo.value = null
  audioArquivo.value = null
  imagemNome.value = null
  audioNome.value = null

  if (tipo.value === 'imagem' && campanha.url_midia) {
    imagemPreviewUrl.value = campanha.url_midia
    imagemNome.value = 'Imagem da campanha'
  } else if (tipo.value === 'audio' && campanha.url_midia) {
    audioObjectUrl.value = campanha.url_midia
    audioNome.value = 'Áudio da campanha'
  }
}

function aplicarEstadoAoAbrir() {
  etapaAtual.value = 0
  void carregarCanaisSeNecessario()
  void carregarFunisSeNecessario()

  const campanhaId = props.campanhaId?.trim()
  if (campanhaId) {
    const campanha =
      disparoEmMassa.campanhaEmEdicao ??
      campanhas.value.find((c) => c.id === campanhaId) ??
      null
    if (campanha) {
      preencherFormulario(campanha)
      return
    }
  }

  resetFormulario()
}

function isCanalSelecionado(canalId: number) {
  return canaisSelecionados.value.includes(canalId)
}

function toggleCanal(canalId: number) {
  if (isCanalSelecionado(canalId)) {
    canaisSelecionados.value = canaisSelecionados.value.filter((id) => id !== canalId)
    return
  }
  canaisSelecionados.value = [...canaisSelecionados.value, canalId]
}

function isFonteCanalSelecionado(canalId: number) {
  return fonteCanaisSelecionados.value.includes(canalId)
}

function toggleFonteCanal(canalId: number) {
  if (isFonteCanalSelecionado(canalId)) {
    fonteCanaisSelecionados.value = fonteCanaisSelecionados.value.filter((id) => id !== canalId)
    return
  }
  fonteCanaisSelecionados.value = [...fonteCanaisSelecionados.value, canalId]
}

function selecionarTodosFonteCanais() {
  fonteCanaisSelecionados.value = canaisStore.items.map((c) => c.id)
}

function limparFonteCanaisSelecionados() {
  fonteCanaisSelecionados.value = []
}

function selecionarTodosCanais() {
  canaisSelecionados.value = canaisStore.items.map((c) => c.id)
}

function limparCanaisSelecionados() {
  canaisSelecionados.value = []
}

function isColunaSelecionada(colunaId: number) {
  return colunasSelecionadas.value.includes(colunaId)
}

function toggleColuna(colunaId: number) {
  if (isColunaSelecionada(colunaId)) {
    colunasSelecionadas.value = colunasSelecionadas.value.filter((id) => id !== colunaId)
    return
  }
  colunasSelecionadas.value = [...colunasSelecionadas.value, colunaId]
}

function selecionarTodasColunas() {
  colunasSelecionadas.value = funis.value.flatMap((funil) => funil.columns.map((coluna) => coluna.id))
}

async function carregarFunisSeNecessario() {
  const wid = workspaceIdAtual()
  if (wid == null) return
  try {
    await kanban.ensureFunisLoaded(wid)
  } catch {
    /* erro em funisError */
  }
}

async function carregarCanaisSeNecessario() {
  const wid = workspaceIdAtual()
  if (wid == null) return
  try {
    await canaisStore.ensureCanaisLoaded(wid)
  } catch {
    /* erro em canaisStore.listError */
  }
}

function limparColunasSelecionadas() {
  colunasSelecionadas.value = []
}

function isColunaAposDisparo(colunaId: number) {
  return colunaAposDisparoId.value === colunaId
}

function selecionarColunaAposDisparo(colunaId: number) {
  colunaAposDisparoId.value = colunaId
  funilIdAposDisparo.value = funilIdDaColuna(colunaId)
}

function funilIdDaColuna(colunaId: number): number | null {
  for (const funil of funis.value) {
    if (funil.columns.some((coluna) => coluna.id === colunaId)) return funil.id
  }
  return null
}

/** Funil da coluna «mover após o disparo» (`campanhas.funil_id`). */
function funilIdAposDisparoParaCampanha(): string | null {
  if (colunaAposDisparoId.value != null) {
    const funilId = funilIdDaColuna(colunaAposDisparoId.value)
    if (funilId != null) return String(funilId)
  }
  if (funilIdAposDisparo.value != null) return String(funilIdAposDisparo.value)
  return null
}

function limparColunaAposDisparo() {
  colunaAposDisparoId.value = null
  funilIdAposDisparo.value = null
}

function isColunaErro(colunaId: number) {
  return colunaErroId.value === colunaId
}

function selecionarColunaErro(colunaId: number) {
  colunaErroId.value = colunaId
  funilErroId.value = funilIdDaColuna(colunaId)
}

/** Funil da coluna de erro (`campanhas.funil_erro_id`). */
function funilErroIdParaCampanha(): string | null {
  if (colunaErroId.value != null) {
    const funilId = funilIdDaColuna(colunaErroId.value)
    if (funilId != null) return String(funilId)
  }
  if (funilErroId.value != null) return String(funilErroId.value)
  return null
}

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

function mensagemErroFetch(err: unknown): string {
  const o = err as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return o.data?.statusMessage ?? o.statusMessage ?? o.message ?? 'Não foi possível criar a campanha.'
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function cancelarProgresso() {
  abortController?.abort()
}

onMounted(() => {
  aplicarEstadoAoAbrir()
})

watch(
  () => props.campanhaId,
  () => {
    aplicarEstadoAoAbrir()
  },
)

watch([funis, () => props.campanhaId], () => {
  if (!modoEdicao.value) return
  if (colunaAposDisparoId.value != null) {
    const fidColuna = funilIdDaColuna(colunaAposDisparoId.value)
    if (fidColuna != null) funilIdAposDisparo.value = fidColuna
  }
  if (colunaErroId.value != null) {
    const fidErro = funilIdDaColuna(colunaErroId.value)
    if (fidErro != null) funilErroId.value = fidErro
  }
})

watch(campanhas, () => {
  if (!props.campanhaId?.trim()) return
  const campanha =
    disparoEmMassa.campanhaEmEdicao ??
    campanhas.value.find((c) => c.id === props.campanhaId) ??
    null
  if (campanha && !nomeCampanha.value.trim()) {
    preencherFormulario(campanha)
  }
})

function fechar() {
  abortarMidiaTemporariaNavegador()
  emit('cancelar')
}

function minutosDesdeMeiaNoite(hora: string): number {
  const [h, m] = hora.split(':').map((part) => Number.parseInt(part, 10))
  return (h ?? 0) * 60 + (m ?? 0)
}

function validar(): string | null {
  if (!nomeCampanha.value.trim()) return 'Informe o nome da campanha.'
  if (!dataCampo.value.trim()) return 'Informe a data de início.'
  if (!horaCampo.value.trim()) return 'Informe o horário de início.'
  if (!horaPermitidaInicio.value.trim()) return 'Informe a hora permitida de início.'
  if (!horaPermitidaFim.value.trim()) return 'Informe a hora permitida de fim.'
  if (minutosDesdeMeiaNoite(horaPermitidaInicio.value) >= minutosDesdeMeiaNoite(horaPermitidaFim.value)) {
    return 'A hora permitida de início deve ser anterior à hora de fim.'
  }
  if (!Number.isFinite(intervaloMinimo.value) || intervaloMinimo.value < 1) {
    return 'Informe o intervalo mínimo (mínimo 1 minuto).'
  }
  if (!Number.isFinite(intervaloMaximo.value) || intervaloMaximo.value < 1) {
    return 'Informe o intervalo máximo (mínimo 1 minuto).'
  }
  if (intervaloMinimo.value > intervaloMaximo.value) {
    return 'O intervalo mínimo não pode ser maior que o máximo.'
  }
  if (!Number.isFinite(tamanhoLote.value) || tamanhoLote.value < 1) {
    return 'Informe o tamanho do lote (mínimo 1).'
  }
  if (!Number.isFinite(pausaLoteMinutos.value) || pausaLoteMinutos.value < 1) {
    return 'Informe a pausa entre lotes (mínimo 1 minuto).'
  }
  if (canaisSelecionados.value.length === 0) return 'Selecione pelo menos um canal de envio.'
  if (!modoEdicao.value && colunasSelecionadas.value.length === 0) {
    return 'Selecione pelo menos uma coluna do Kanban.'
  }
  if (fonteCanaisSelecionados.value.length === 0) {
    return 'Selecione pelo menos um canal fonte para buscar destinatários.'
  }
  if (tipo.value === 'texto' && !mensagem.value.trim()) return 'Preencha a mensagem.'
  if (gravandoUi.value) return 'Finalize ou cancele a gravação antes de salvar.'
  if (tipo.value === 'imagem' && !imagemArquivo.value && !imagemPreviewUrl.value) {
    return 'Anexe uma imagem.'
  }
  if (tipo.value === 'audio' && !audioArquivo.value && !audioObjectUrl.value) {
    return 'Grave um áudio no navegador ou importe um arquivo de áudio.'
  }
  if (colunaErroId.value == null) {
    return 'Selecione a coluna para mover o contato em caso de erro no envio.'
  }
  return null
}

function montarCorpoCampanha(workspaceId: number) {
  let mime: string | null = null
  let data_base64: string | null = null
  let filename: string | null = null

  if (tipo.value === 'imagem' && imagemArquivo.value) {
    return arquivoParaBase64Payload(imagemArquivo.value).then((part) => ({
      workspace_id: workspaceId,
      nome: nomeCampanha.value.trim(),
      status: statusCampanha.value,
      ia_ligada: iaLigada.value,
      visualizacao_unica:
        tipo.value === 'imagem' || tipo.value === 'audio' ? visualizacaoUnica.value : false,
      tipo_mensagem: tipo.value,
      conteudo_texto: mensagem.value.trim() || null,
      canais_ids: [...canaisSelecionados.value],
      coluna_ids: colunasSelecionadas.value.length > 0 ? [...colunasSelecionadas.value] : undefined,
      funil_id: funilIdAposDisparoParaCampanha(),
      coluna_id: colunaAposDisparoId.value,
      coluna_erro_id: colunaErroId.value!,
      funil_erro_id: funilErroIdParaCampanha(),
      fonte_canais_ids: [...fonteCanaisSelecionados.value],
      envia_para_grupo: enviaParaGrupo.value,
      intervalo_minimo_minutos: intervaloMinimo.value,
      intervalo_maximo_minutos: intervaloMaximo.value,
      tamanho_lote: tamanhoLote.value,
      pausa_lote_minutos: pausaLoteMinutos.value,
      data_local: dataCampo.value.trim(),
      hora_local: horaCampo.value.trim(),
      timezone_escolhido: ianaTimezone.value,
      hora_permitida_inicio: horaPermitidaInicio.value.trim(),
      hora_permitida_fim: horaPermitidaFim.value.trim(),
      mime: part.mime,
      data_base64: part.data_base64,
      filename: part.filename,
    }))
  }

  if (tipo.value === 'audio' && audioArquivo.value) {
    return arquivoParaBase64Payload(audioArquivo.value).then((part) => ({
      workspace_id: workspaceId,
      nome: nomeCampanha.value.trim(),
      status: statusCampanha.value,
      ia_ligada: iaLigada.value,
      visualizacao_unica:
        tipo.value === 'imagem' || tipo.value === 'audio' ? visualizacaoUnica.value : false,
      tipo_mensagem: tipo.value,
      conteudo_texto: mensagem.value.trim() || null,
      canais_ids: [...canaisSelecionados.value],
      coluna_ids: colunasSelecionadas.value.length > 0 ? [...colunasSelecionadas.value] : undefined,
      funil_id: funilIdAposDisparoParaCampanha(),
      coluna_id: colunaAposDisparoId.value,
      coluna_erro_id: colunaErroId.value!,
      funil_erro_id: funilErroIdParaCampanha(),
      fonte_canais_ids: [...fonteCanaisSelecionados.value],
      envia_para_grupo: enviaParaGrupo.value,
      intervalo_minimo_minutos: intervaloMinimo.value,
      intervalo_maximo_minutos: intervaloMaximo.value,
      tamanho_lote: tamanhoLote.value,
      pausa_lote_minutos: pausaLoteMinutos.value,
      data_local: dataCampo.value.trim(),
      hora_local: horaCampo.value.trim(),
      timezone_escolhido: ianaTimezone.value,
      hora_permitida_inicio: horaPermitidaInicio.value.trim(),
      hora_permitida_fim: horaPermitidaFim.value.trim(),
      mime: part.mime,
      data_base64: part.data_base64,
      filename: part.filename,
    }))
  }

  return Promise.resolve({
    workspace_id: workspaceId,
    nome: nomeCampanha.value.trim(),
    status: statusCampanha.value,
    ia_ligada: iaLigada.value,
    visualizacao_unica:
      tipo.value === 'imagem' || tipo.value === 'audio' ? visualizacaoUnica.value : false,
    tipo_mensagem: tipo.value,
    conteudo_texto: mensagem.value.trim() || null,
    canais_ids: [...canaisSelecionados.value],
    coluna_ids: colunasSelecionadas.value.length > 0 ? [...colunasSelecionadas.value] : undefined,
    funil_id: funilIdAposDisparoParaCampanha(),
    coluna_id: colunaAposDisparoId.value,
    coluna_erro_id: colunaErroId.value!,
    funil_erro_id: funilErroIdParaCampanha(),
    fonte_canais_ids: [...fonteCanaisSelecionados.value],
    envia_para_grupo: enviaParaGrupo.value,
    intervalo_minimo_minutos: intervaloMinimo.value,
    intervalo_maximo_minutos: intervaloMaximo.value,
    tamanho_lote: tamanhoLote.value,
    pausa_lote_minutos: pausaLoteMinutos.value,
    data_local: dataCampo.value.trim(),
    hora_local: horaCampo.value.trim(),
    timezone_escolhido: ianaTimezone.value,
    hora_permitida_inicio: horaPermitidaInicio.value.trim(),
    hora_permitida_fim: horaPermitidaFim.value.trim(),
    mime: null as string | null,
    data_base64: null as string | null,
    filename: null as string | null,
  })
}

async function salvarEdicao(workspaceId: number, signal: AbortSignal) {
  const campanhaId = props.campanhaId?.trim()
  if (!campanhaId) {
    toast.error('Campanha não encontrada para edição.')
    return
  }

  progressoTitulo.value = 'Salvando campanha…'
  progressoEtapa.value = 'Atualizando configurações…'
  progressoTotal.value = 1
  progressoEnviados.value = 0
  progressoErro.value = null
  progressoAberto.value = true

  const body = await montarCorpoCampanha(workspaceId)
  const atualizarResponse = await $fetch<AtualizarCampanhaResponse>('/api/kanban/disparo_em_massa', {
    method: 'PATCH',
    signal,
    body: {
      ...body,
      campanha_id: campanhaId,
    },
  })

  progressoEnviados.value = 1
  emit('atualizado', atualizarResponse)
  toast.success('Campanha atualizada com sucesso.')
}

async function salvarNova(workspaceId: number, signal: AbortSignal) {
  progressoTitulo.value = 'Criando campanha…'
  progressoEtapa.value = 'Etapa 1 de 2: Criando campanha…'
  progressoTotal.value = 1
  progressoEnviados.value = 0
  progressoErro.value = null
  progressoAberto.value = true

  const body = await montarCorpoCampanha(workspaceId)
  const colunaIds = colunasSelecionadas.value
  if (!colunaIds.length) {
    throw new Error('Selecione pelo menos uma coluna do Kanban.')
  }

  const criarResponse = await $fetch<CriarCampanhaResponse>('/api/kanban/disparo_em_massa', {
    method: 'POST',
    signal,
    body: {
      ...body,
      coluna_ids: [...colunaIds],
    },
  })

  const { campanha, conversa_keys } = criarResponse
  progressoEnviados.value = 1
  progressoTotal.value = 1 + conversa_keys.length

  if (conversa_keys.length > 0) {
    progressoTitulo.value = 'Enfileirando disparos…'
    progressoEtapa.value = 'Etapa 2 de 2: Enfileirando disparos…'

    let enfileirados = 0
    for (const lote of chunkArray(conversa_keys, FILA_LOTE)) {
      await $fetch<EnfileirarFilaDisparoResponse>('/api/kanban/disparo_em_massa/fila', {
        method: 'POST',
        signal,
        body: {
          campanha_id: String(campanha.id),
          conversa_keys: lote,
        },
      })
      enfileirados += lote.length
      progressoEnviados.value = 1 + enfileirados
    }
  }

  emit('criado', criarResponse)
  toast.success(
    conversa_keys.length === 0
      ? 'Campanha criada (nenhum contato na fila).'
      : `Campanha criada com ${conversa_keys.length} contato(s) na fila.`,
  )
}

async function salvar() {
  const erro = validar()
  if (erro) {
    toast.error(erro)
    return
  }

  const workspaceId = workspaceIdAtual()
  if (!workspaceId) {
    toast.error('Workspace não selecionado.')
    return
  }

  submitPending.value = true
  abortController = new AbortController()
  const signal = abortController.signal

  try {
    if (modoEdicao.value) {
      await salvarEdicao(workspaceId, signal)
    } else {
      await salvarNova(workspaceId, signal)
    }
  } catch (err: unknown) {
    const e = err as { name?: string }
    if (e?.name === 'AbortError') {
      toast.info(modoEdicao.value ? 'Atualização cancelada.' : 'Criação da campanha cancelada.')
    } else {
      const msg = mensagemErroFetch(err)
      progressoErro.value = msg
      toast.error(msg)
    }
  } finally {
    submitPending.value = false
    abortController = null
    if (!progressoErro.value) progressoAberto.value = false
  }
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-outline/30 bg-surface-container-lowest/90 font-body text-on-surface shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container-low/85"
  >
    <div class="flex min-h-[min(62vh,600px)] flex-col p-4 md:p-6">
    <header class="mb-4 shrink-0 flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
          :disabled="submitPending"
          @click="fechar"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
          Fechar
        </button>
        <h2 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
          {{ tituloExibicao }}
        </h2>
        <p class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ rotuloEtapa }}
        </p>
      </div>
    </header>

    <div class="campanha-form flex-1 pb-2">
      <!-- Identificação -->
      <section v-show="etapaAtual === 0" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-primary-500/15 to-indigo-500/10 text-primary-600 dark:from-primary-400/20 dark:to-indigo-400/10 dark:text-primary-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">campaign</span>
          </span>
          <div class="min-w-0 flex-1">
            <label :class="[labelCls, 'mb-2 block']" for="campanha-nome">
              Nome da campanha <span class="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="campanha-nome"
              v-model="nomeCampanha"
              type="text"
              required
              placeholder="Ex.: Promoção de verão"
              :class="inputCls"
            />
          </div>
        </div>
      </section>

      <!-- Comportamento -->
      <section v-show="etapaAtual === 1" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-violet-500/15 to-primary-500/10 text-violet-600 dark:from-violet-400/20 dark:text-violet-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">tune</span>
          </span>
          <div class="min-w-0 flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <p :class="labelCls">
                Status da campanha <span class="text-danger" aria-hidden="true">*</span>
              </p>
              <div class="flex flex-wrap gap-2" role="group" aria-label="Status da campanha">
                <button
                  v-for="s in statusOpcoes"
                  :key="s.id"
                  type="button"
                  :class="classeSegmento(statusCampanha === s.id)"
                  :aria-pressed="statusCampanha === s.id"
                  @click="statusCampanha = s.id"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ s.icon }}</span>
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <p :class="labelCls">
                IA após o disparo <span class="text-danger" aria-hidden="true">*</span>
              </p>
              <div class="flex flex-wrap gap-2" role="group" aria-label="IA após o disparo">
                <button
                  v-for="opc in iaOpcoes"
                  :key="String(opc.value)"
                  type="button"
                  :class="classeSegmento(iaLigada === opc.value)"
                  :aria-pressed="iaLigada === opc.value"
                  @click="iaLigada = opc.value"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ opc.icon }}</span>
                  {{ opc.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Conteúdo -->
      <section v-show="etapaAtual === 2" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-sky-500/15 to-cyan-500/10 text-sky-600 dark:from-sky-400/20 dark:text-sky-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">forum</span>
          </span>
          <div class="min-w-0 flex-1">
            <p :class="[labelCls, 'mb-2']">
              Tipo de mensagem <span class="text-danger" aria-hidden="true">*</span>
            </p>
            <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Tipo de mensagem">
          <button
            v-for="t in tiposOpcoes"
            :key="t.id"
            type="button"
            :class="classeSegmento(tipo === t.id)"
            :aria-pressed="tipo === t.id"
            @click="tipo = t.id"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ t.icon }}</span>
            {{ t.label }}
          </button>
        </div>

        <div
          class="rounded-xl border border-outline/25 bg-surface-container-lowest/70 p-4 shadow-inner dark:border-dark-outline/20 dark:bg-dark-surface-container-low/60"
        >
          <template v-if="tipo === 'texto'">
            <label :class="labelCls" for="campanha-mensagem">Mensagem</label>
            <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Variáveis da mensagem">
              <button
                v-for="v in variaveisMensagem"
                :key="v.id"
                type="button"
                :class="classeChipAcao()"
                :title="v.hint"
                @click="inserirVariavelMensagem(v.id)"
              >
                <span class="font-mono text-[11px] text-primary-700 dark:text-violet-300">{{ rotuloVariavelMensagem(v.id) }}</span>
                <span class="ml-1.5 text-on-surface-variant dark:text-dark-on-surface-variant">{{ v.label }}</span>
              </button>
            </div>
            <textarea
              id="campanha-mensagem"
              ref="mensagemTextareaRef"
              v-model="mensagem"
              rows="5"
              placeholder="Insira a mensagem da campanha"
              :class="[inputCls, 'mt-2 resize-none']"
            />
          </template>

          <template v-else-if="tipo === 'imagem'">
            <label :class="labelCls" for="campanha-legenda">Legenda (opcional)</label>
            <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Variáveis da legenda">
              <button
                v-for="v in variaveisMensagem"
                :key="v.id"
                type="button"
                :class="classeChipAcao()"
                :title="v.hint"
                @click="inserirVariavelMensagem(v.id)"
              >
                <span class="font-mono text-[11px] text-primary-700 dark:text-violet-300">{{ rotuloVariavelMensagem(v.id) }}</span>
                <span class="ml-1.5 text-on-surface-variant dark:text-dark-on-surface-variant">{{ v.label }}</span>
              </button>
            </div>
            <textarea
              id="campanha-legenda"
              ref="mensagemTextareaRef"
              v-model="mensagem"
              rows="3"
              placeholder="Legenda da imagem"
              :class="[inputCls, 'mt-2 resize-none']"
            />
            <input ref="imagemInputRef" type="file" accept="image/*" class="hidden" @change="onImagemChange" />
            <div class="mt-3">
              <BaseButton variant="secondary" :block="false" @click="imagemInputRef?.click()">
                <span class="inline-flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">attach_file</span>
                  Selecionar imagem
                </span>
              </BaseButton>
            </div>
            <div
              v-if="imagemPreviewUrl"
              class="mt-3 flex items-start gap-3 rounded-xl border border-outline/30 bg-surface p-3 shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container"
            >
              <div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-outline/25 shadow-sm dark:border-dark-outline/25">
                <img :src="imagemPreviewUrl" alt="Prévia da imagem" class="h-full w-full object-cover" />
              </div>
              <div class="min-w-0 flex-1 pt-0.5">
                <p class="truncate text-sm font-bold text-on-surface dark:text-dark-on-surface">{{ imagemNome }}</p>
              </div>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                @click="removerImagemAnexada"
              >
                Remover
              </button>
            </div>
          </template>

          <template v-else>
            <p :class="labelCls">Áudio da campanha</p>
            <input ref="audioInputRef" type="file" accept="audio/*" class="hidden" @change="onAudioChange" />
            <div class="mt-3 flex flex-wrap gap-2">
              <BaseButton
                variant="secondary"
                :block="false"
                :disabled="gravandoUi"
                class="!border-sky-300/80 !bg-sky-50 !text-sky-950 shadow-sm hover:!border-sky-400 hover:!bg-sky-100 hover:!text-sky-950 dark:!border-sky-500/55 dark:!bg-sky-950/50 dark:!text-sky-100 dark:hover:!border-sky-400/70 dark:hover:!bg-sky-900/55 dark:hover:!text-white"
                @click="audioInputRef?.click()"
              >
                <span class="inline-flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
                  Importar áudio
                </span>
              </BaseButton>
              <BaseButton variant="secondary" :block="false" :disabled="gravandoUi" @click="toggleGravacaoAudio">
                <span class="inline-flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">mic</span>
                  Gravar áudio
                </span>
              </BaseButton>
            </div>
            <div
              v-if="gravandoUi"
              class="relative z-10 mt-4 rounded-xl border border-danger/25 bg-gradient-to-r from-danger/5 to-transparent p-4 dark:from-danger/10"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-2 text-sm font-bold text-on-surface dark:text-dark-on-surface">
                  <span class="relative flex h-2.5 w-2.5">
                    <span
                      v-if="!gravacaoPausada"
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70"
                    />
                    <span
                      class="relative inline-flex h-2.5 w-2.5 rounded-full"
                      :class="gravacaoPausada ? 'bg-amber-500' : 'bg-danger'"
                    />
                  </span>
                  {{ gravacaoPausada ? 'Gravação pausada' : 'Gravando…' }}
                </span>
                <span class="font-mono text-sm font-semibold tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
                  {{ String(Math.floor(elapsedSegundos / 60)).padStart(2, '0') }}:{{ String(elapsedSegundos % 60).padStart(2, '0') }}
                </span>
              </div>
              <div class="relative z-10 mt-3 flex flex-wrap gap-2">
                <BaseButton variant="secondary" :block="false" type="button" @click="togglePausaGravacao">
                  <span class="inline-flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {{ gravacaoPausada ? 'play_arrow' : 'pause' }}
                    </span>
                    {{ gravacaoPausada ? 'Retomar' : 'Pausar' }}
                  </span>
                </BaseButton>
                <BaseButton variant="primary" :block="false" type="button" @click="finalizarGravacaoAudio">
                  <span class="inline-flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">stop_circle</span>
                    Finalizar
                  </span>
                </BaseButton>
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger shadow-sm transition-all duration-200 hover:bg-danger/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 active:scale-[0.98] dark:border-danger/50 dark:bg-danger/15 dark:text-red-300 dark:hover:bg-danger/25"
                  @click="cancelarGravacaoAudio"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                  Cancelar
                </button>
              </div>
            </div>
            <div
              v-if="audioObjectUrl && !gravandoUi"
              class="mt-4 rounded-xl border border-outline/30 bg-surface p-4 shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container"
            >
              <div class="mb-2 flex items-start justify-between gap-3">
                <p v-if="audioNome" class="min-w-0 flex-1 truncate text-xs font-bold text-on-surface-variant dark:text-dark-on-surface-variant">
                  {{ audioNome }}
                </p>
                <button
                  type="button"
                  class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                  @click="removerAudioAnexado"
                >
                  Remover
                </button>
              </div>
              <audio :src="audioObjectUrl" controls class="w-full max-w-full" />
            </div>
          </template>

          <div
            v-if="tipo === 'imagem' || tipo === 'audio'"
            class="mt-4 border-t border-outline/20 pt-4 dark:border-dark-outline/20"
          >
            <label
              class="group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200"
              :class="
                visualizacaoUnica
                  ? 'border-violet-400/50 bg-gradient-to-r from-violet-50/80 to-indigo-50/40 shadow-[0_2px_10px_rgba(124,58,237,0.1)] dark:border-violet-500/40 dark:from-violet-950/35 dark:to-indigo-950/25'
                  : 'border-outline/30 bg-surface-container-lowest/50 hover:border-outline/45 hover:bg-surface-container-high/40 dark:border-dark-outline/30 dark:bg-dark-surface-container/40 dark:hover:border-dark-outline/45'
              "
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200"
                :class="
                  visualizacaoUnica
                    ? 'bg-violet-500/15 text-violet-600 dark:bg-violet-400/20 dark:text-violet-300'
                    : 'bg-surface-container-high text-on-surface-variant group-hover:text-on-surface dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant dark:group-hover:text-dark-on-surface'
                "
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[20px]">
                  {{ visualizacaoUnica ? 'looks_one' : 'visibility' }}
                </span>
              </span>
              <span class="min-w-0 flex-1 text-sm font-bold text-on-surface dark:text-dark-on-surface">
                Visualização única
              </span>
              <span class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
                <input
                  v-model="visualizacaoUnica"
                  type="checkbox"
                  class="peer sr-only"
                  aria-label="Enviar com visualização única"
                />
                <span
                  class="h-6 w-11 rounded-full border border-outline/40 bg-surface-container-high shadow-inner transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500/35 peer-checked:border-violet-500/50 peer-checked:bg-violet-500 dark:border-dark-outline/45 dark:bg-dark-surface-container-high dark:peer-focus-visible:ring-violet-400/35 dark:peer-checked:border-violet-400/55 dark:peer-checked:bg-violet-500"
                  aria-hidden="true"
                />
                <span
                  class="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5 dark:bg-slate-100"
                  aria-hidden="true"
                />
              </span>
            </label>
          </div>
        </div>
          </div>
        </div>
      </section>

      <!-- Agendamento -->
      <section v-show="etapaAtual === 3" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600 dark:from-amber-400/20 dark:text-amber-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">schedule</span>
          </span>
          <div class="min-w-0 flex-1 space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-data">
                  Data de início <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input id="campanha-data" v-model="dataCampo" type="date" required :class="inputCls" />
              </div>
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-hora">
                  Hora de início <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="campanha-hora"
                  v-model="horaCampo"
                  type="time"
                  required
                  :class="[inputCls, 'dark:[color-scheme:dark]']"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant" for="campanha-fuso">
                Fuso horário do agendamento
              </label>
              <p class="text-[11px] leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
                A data e a hora acima são interpretadas neste fuso (lista Brasil).
              </p>
              <select
                id="campanha-fuso"
                v-model="ianaTimezone"
                :class="inputCls"
              >
                <option v-for="op in opcoesFusoBrasil" :key="op.value" :value="op.value">
                  {{ op.label }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-hora-permitida-inicio">
                  Hora permitida — início <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="campanha-hora-permitida-inicio"
                  v-model="horaPermitidaInicio"
                  type="time"
                  required
                  :class="[inputCls, 'dark:[color-scheme:dark]']"
                />
              </div>
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-hora-permitida-fim">
                  Hora permitida — fim <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="campanha-hora-permitida-fim"
                  v-model="horaPermitidaFim"
                  type="time"
                  required
                  :class="[inputCls, 'dark:[color-scheme:dark]']"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-intervalo-min">
                  Intervalo mínimo (min) <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="campanha-intervalo-min"
                  v-model.number="intervaloMinimo"
                  type="number"
                  min="1"
                  required
                  :class="inputCls"
                />
              </div>
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-intervalo-max">
                  Intervalo máximo (min) <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="campanha-intervalo-max"
                  v-model.number="intervaloMaximo"
                  type="number"
                  min="1"
                  required
                  :class="inputCls"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-tamanho-lote">
                  Tamanho do lote <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <p :class="hintCls">Quantidade de mensagens enviadas antes da pausa.</p>
                <input
                  id="campanha-tamanho-lote"
                  v-model.number="tamanhoLote"
                  type="number"
                  min="1"
                  required
                  :class="inputCls"
                />
              </div>
              <div class="space-y-2">
                <label :class="labelCls" for="campanha-pausa-lote">
                  Pausa entre lotes (min) <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <p :class="hintCls">Tempo de espera após cada lote.</p>
                <input
                  id="campanha-pausa-lote"
                  v-model.number="pausaLoteMinutos"
                  type="number"
                  min="1"
                  required
                  :class="inputCls"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Entrega -->
      <section v-show="etapaAtual === 4" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:from-emerald-400/20 dark:text-emerald-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">send</span>
          </span>
          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p :class="labelCls">
                Canais de envio <span class="text-danger" aria-hidden="true">*</span>
                <span
                  v-if="canaisSelecionados.length > 0"
                  class="ml-2 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                >
                  · {{ canaisSelecionados.length }} selecionado(s)
                </span>
              </p>
            </div>

            <div
              class="rounded-xl border border-outline/25 bg-surface-container-lowest/60 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50"
            >
              <p v-if="canaisStore.listPending" :class="hintCls">Carregando canais…</p>

              <template v-else>
                <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    :class="classeChipAcao()"
                    :disabled="canaisStore.items.length === 0"
                    @click="selecionarTodosCanais"
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    :class="classeChipAcao()"
                    :disabled="canaisSelecionados.length === 0"
                    @click="limparCanaisSelecionados"
                  >
                    Limpar
                  </button>
                </div>

                <p v-if="canaisStore.items.length === 0" :class="hintCls">
                  Nenhum canal neste workspace.
                </p>

                <ul v-else class="max-h-72 space-y-2 overflow-y-auto pr-0.5" role="list">
                  <li v-for="c in canaisStore.items" :key="c.id">
                    <label :class="classeColunaItem(isCanalSelecionado(c.id))">
                      <span class="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                          :checked="isCanalSelecionado(c.id)"
                          @change="toggleCanal(c.id)"
                        />
                        <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                          {{ (c.nome ?? '').trim() || `Canal #${c.id}` }}
                        </span>
                      </span>
                    </label>
                  </li>
                </ul>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- Filtros -->
      <section v-show="etapaAtual === 5" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-orange-500/15 to-amber-500/10 text-orange-600 dark:from-orange-400/20 dark:text-orange-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">filter_alt</span>
          </span>
          <div class="min-w-0 flex-1 space-y-3">
            <p :class="labelCls">Filtros</p>

            <div
              class="rounded-xl border border-outline/25 bg-surface-container-lowest/60 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50"
            >
              <div class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p :class="hintCls">
                    Marque de quais canais buscar as conversas que entrarão na fila do disparo.
                    <span class="text-danger" aria-hidden="true">*</span>
                    <span
                      v-if="fonteCanaisSelecionados.length > 0"
                      class="ml-2 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                    >
                      · {{ fonteCanaisSelecionados.length }} selecionado(s)
                    </span>
                  </p>
                </div>

                <p v-if="canaisStore.listPending" :class="hintCls">Carregando canais…</p>

                <template v-else>
                  <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      :class="classeChipAcao()"
                      :disabled="canaisStore.items.length === 0"
                      @click="selecionarTodosFonteCanais"
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      :class="classeChipAcao()"
                      :disabled="fonteCanaisSelecionados.length === 0"
                      @click="limparFonteCanaisSelecionados"
                    >
                      Limpar
                    </button>
                  </div>

                  <p v-if="canaisStore.items.length === 0" :class="hintCls">
                    Nenhum canal neste workspace.
                  </p>

                  <ul v-else class="max-h-72 space-y-2 overflow-y-auto pr-0.5" role="list">
                    <li v-for="c in canaisStore.items" :key="`fonte-${c.id}`">
                      <label :class="classeColunaItem(isFonteCanalSelecionado(c.id))">
                        <span class="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                            :checked="isFonteCanalSelecionado(c.id)"
                            @change="toggleFonteCanal(c.id)"
                          />
                          <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                            {{ (c.nome ?? '').trim() || `Canal #${c.id}` }}
                          </span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </template>
              </div>

              <div class="mt-4 border-t border-outline/20 pt-4 dark:border-dark-outline/20">
                <label class="inline-flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    v-model="enviaParaGrupo"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-outline/50 text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50"
                  />
                  <span class="space-y-1">
                    <span class="block text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                      Enviar para grupos
                    </span>
                    <span :class="hintCls">
                      Quando desmarcado, exclui conversas de grupo WhatsApp da fila.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Destinatários -->
      <section v-show="etapaAtual === 6" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-blue-500/15 to-indigo-500/10 text-blue-600 dark:from-blue-400/20 dark:text-blue-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">groups</span>
          </span>
          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p :class="labelCls">
                Destinatários
                <span v-if="!modoEdicao" class="text-danger" aria-hidden="true">*</span>
              </p>
              <button
                v-if="!modoEdicao"
                type="button"
                :class="classeSegmento(filtroDestinatario === 'coluna', true)"
                aria-pressed="true"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">view_kanban</span>
                Por coluna
              </button>
            </div>

            <div
              v-if="modoEdicao"
              class="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/30"
              role="status"
            >
              <div class="flex gap-3">
                <span
                  class="material-symbols-outlined shrink-0 text-[22px] text-amber-700 dark:text-amber-300"
                  aria-hidden="true"
                >
                  info
                </span>
                <div class="min-w-0 space-y-1">
                  <p class="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    Destinatários não podem ser alterados
                  </p>
                  <p class="text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                    Após a criação da campanha, não é possível editar as colunas de destinatários.
                    Se precisar mudar quem receberá o disparo, exclua esta campanha e crie uma nova.
                  </p>
                </div>
              </div>
            </div>

            <div
              class="rounded-xl border border-outline/25 bg-surface-container-lowest/60 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50"
              :class="modoEdicao ? 'pointer-events-none select-none opacity-55' : ''"
              :aria-disabled="modoEdicao ? 'true' : undefined"
            >
              <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  :class="classeChipAcao()"
                  :disabled="funisPending || totalColunasFunis === 0"
                  @click="selecionarTodasColunas"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  :class="classeChipAcao()"
                  :disabled="colunasSelecionadas.length === 0"
                  @click="limparColunasSelecionadas"
                >
                  Limpar
                </button>
              </div>

              <p v-if="funisPending" :class="hintCls">Carregando funis e colunas…</p>

              <p v-else-if="funisError" class="text-sm text-danger">
                {{ funisError }}
              </p>

              <p v-else-if="totalColunasFunis === 0" :class="hintCls">
                Nenhuma coluna encontrada nos funis deste workspace.
              </p>

              <div v-else class="max-h-80 space-y-4 overflow-y-auto pr-0.5">
                <section v-for="funil in funisComColunas" :key="funil.id" class="space-y-2">
                  <p class="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                    {{ funil.nome?.trim() || `Funil #${funil.id}` }}
                  </p>
                  <ul class="space-y-2" role="list">
                    <li v-for="coluna in funil.columns" :key="coluna.id">
                      <label :class="classeColunaItem(isColunaSelecionada(coluna.id))">
                        <span class="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                            :checked="isColunaSelecionada(coluna.id)"
                            @change="toggleColuna(coluna.id)"
                          />
                          <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                            {{ coluna.nome?.trim() || `Coluna #${coluna.id}` }}
                          </span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Mover após o disparo -->
      <section v-show="etapaAtual === 7" :class="sectionCls">
        <div class="flex items-start gap-3">
          <span
            :class="[
              secaoIconCls,
              'bg-gradient-to-br from-fuchsia-500/15 to-pink-500/10 text-fuchsia-600 dark:from-fuchsia-400/20 dark:text-fuchsia-300',
            ]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[20px]">move_down</span>
          </span>
          <div class="min-w-0 flex-1 space-y-3">
            <div class="space-y-1">
              <p :class="labelCls">Mover para etapa após o disparo</p>
              <p :class="hintCls">
                Selecione a coluna do funil para onde o contato será movido depois do envio.
              </p>
            </div>

            <div
              class="rounded-xl border border-outline/25 bg-surface-container-lowest/60 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50"
            >
              <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  :class="classeChipAcao()"
                  :disabled="colunaAposDisparoId == null"
                  @click="limparColunaAposDisparo"
                >
                  Não mover
                </button>
              </div>

              <p v-if="funisPending" :class="hintCls">Carregando funis e colunas…</p>

              <p v-else-if="funisError" class="text-sm text-danger">
                {{ funisError }}
              </p>

              <p v-else-if="totalColunasFunis === 0" :class="hintCls">
                Nenhuma coluna encontrada nos funis deste workspace.
              </p>

              <div v-else class="max-h-80 space-y-4 overflow-y-auto pr-0.5" role="listbox" aria-label="Etapa após o disparo">
                <section
                  v-for="funil in funisComColunasAposDisparo"
                  :key="`apos-funil-${funil.id}`"
                  class="space-y-2"
                  :class="funilIdAposDisparo === funil.id ? 'rounded-xl ring-1 ring-primary-500/30 p-1' : ''"
                >
                  <p class="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                    {{ funil.nome?.trim() || `Funil #${funil.id}` }}
                  </p>
                  <ul class="space-y-2" role="list">
                    <li v-for="coluna in funil.columns" :key="`apos-${coluna.id}`">
                      <label :class="classeColunaItem(isColunaAposDisparo(coluna.id))">
                        <span class="flex min-w-0 items-center gap-3">
                          <input
                            type="radio"
                            name="coluna-apos-disparo"
                            class="h-4 w-4 border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                            :checked="isColunaAposDisparo(coluna.id)"
                            @change="selecionarColunaAposDisparo(coluna.id)"
                          />
                          <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                            {{ coluna.nome?.trim() || `Coluna #${coluna.id}` }}
                          </span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </section>
              </div>
            </div>

            <div class="space-y-1 pt-2">
              <p :class="labelCls">
                Mover em caso de erro no envio <span class="text-danger" aria-hidden="true">*</span>
              </p>
              <p :class="hintCls">
                Selecione a coluna do funil para onde o contato será movido se o disparo falhar.
              </p>
            </div>

            <div
              class="rounded-xl border border-outline/25 bg-surface-container-lowest/60 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50"
            >
              <p v-if="funisPending" :class="hintCls">Carregando funis e colunas…</p>

              <p v-else-if="funisError" class="text-sm text-danger">
                {{ funisError }}
              </p>

              <p v-else-if="totalColunasFunis === 0" :class="hintCls">
                Nenhuma coluna encontrada nos funis deste workspace.
              </p>

              <div
                v-else
                class="max-h-80 space-y-4 overflow-y-auto pr-0.5"
                role="listbox"
                aria-label="Etapa em caso de erro no disparo"
              >
                <section
                  v-for="funil in funisComColunasErro"
                  :key="`erro-funil-${funil.id}`"
                  class="space-y-2"
                  :class="funilErroId === funil.id ? 'rounded-xl ring-1 ring-danger/30 p-1' : ''"
                >
                  <p class="text-xs font-bold uppercase tracking-wide text-danger">
                    {{ funil.nome?.trim() || `Funil #${funil.id}` }}
                  </p>
                  <ul class="space-y-2" role="list">
                    <li v-for="coluna in funil.columns" :key="`erro-${coluna.id}`">
                      <label :class="classeColunaItem(isColunaErro(coluna.id))">
                        <span class="flex min-w-0 items-center gap-3">
                          <input
                            type="radio"
                            name="coluna-erro-disparo"
                            required
                            class="h-4 w-4 border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                            :checked="isColunaErro(coluna.id)"
                            @change="selecionarColunaErro(coluna.id)"
                          />
                          <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                            {{ coluna.nome?.trim() || `Coluna #${coluna.id}` }}
                          </span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div
      class="-mx-4 mt-4 flex shrink-0 flex-col-reverse gap-3 border-t border-outline/20 bg-surface-container-lowest/95 px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between dark:border-dark-outline/20 dark:bg-dark-surface-container-low/95 md:-mx-6 md:px-6"
    >
      <BaseButton
        v-if="!ehPrimeiraEtapa"
        variant="secondary"
        :block="false"
        class="w-full sm:w-auto"
        :disabled="submitPending"
        @click="irEtapaAnterior"
      >
        <span class="inline-flex items-center justify-center gap-2 font-semibold">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
          Anterior
        </span>
      </BaseButton>
      <div v-else class="hidden sm:block" />

      <BaseButton
        v-if="!ehUltimaEtapa"
        variant="primary"
        :block="false"
        class="w-full !shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:!shadow-[0_6px_22px_rgba(37,99,235,0.42)] sm:w-auto sm:ml-auto"
        :disabled="submitPending"
        @click="irProximaEtapa"
      >
        <span class="inline-flex items-center justify-center gap-2 font-bold">
          Próximo
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </span>
      </BaseButton>

      <BaseButton
        v-else
        variant="primary"
        :block="false"
        class="w-full !shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:!shadow-[0_6px_22px_rgba(37,99,235,0.42)] sm:w-auto sm:ml-auto"
        :disabled="submitPending"
        @click="salvar()"
      >
        <span class="inline-flex items-center justify-center gap-2 font-bold">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
            {{ submitPending ? 'hourglass_top' : modoEdicao ? 'save' : 'rocket_launch' }}
          </span>
          {{ rotuloBotaoSalvar }}
        </span>
      </BaseButton>
    </div>
    </div>

  <ModalEnvioProdutos
    v-model:open="progressoAberto"
    :title="progressoTitulo"
    :total="progressoTotal"
    :enviados="progressoEnviados"
    :erro="progressoErro"
    :pode-cancelar="submitPending"
    @cancelar="cancelarProgresso"
  >
    <template #extra>
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ progressoEtapa }}
      </p>
    </template>
  </ModalEnvioProdutos>
  </div>
</template>

<style scoped>
.campanha-form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 0;
  gap: 1.5rem;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.campanha-form::-webkit-scrollbar {
  width: 6px;
}

.campanha-form::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 18%, transparent);
}
</style>
