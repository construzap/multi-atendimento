<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import type { CanalCriado } from '~/stores/canais'
import type {
  Canal,
  CanalConfigFollowUp,
  CanalFollowAtivoEmColunas,
  CanalFollowUpTipoMidia,
  CanalFormasPagamento,
  CanalFormasPagamentoEntrega,
  CanalFormasPagamentoOnline,
  CanalHorarioDia,
  CanalHorarioDiaKey,
  CanalHorarios,
  CanalPalavrasAtivacaoFollowUp,
  CanalRegrasFollowUp,
  ListasDoWhatsappResponse,
  WhatsappLabelItem,
  WhatsappLabelMutateResponse,
} from '#shared/types/canal'
import {
  CANAL_FOLLOW_UP_TIPOS_MIDIA,
  CANAL_FORMAS_ENTREGA,
  CANAL_FORMAS_ONLINE,
  CANAL_FORMAS_PAGAMENTO_PADRAO,
  CANAL_HORARIO_DIAS,
  CANAL_REGRAS_FOLLOW_UP_PADRAO,
  WHATSAPP_LABEL_CORES,
  ordenarCanalHorarios,
} from '#shared/types/canal'

type HorarioDia = CanalHorarioDia

const DIAS_HORARIO: { key: CanalHorarioDiaKey; label: string }[] = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
]

function horarioDiaPadrao(partial?: Partial<HorarioDia>): HorarioDia {
  return {
    aberto: partial?.aberto ?? true,
    inicio: partial?.inicio ?? '',
    inicioAlmoco: partial?.inicioAlmoco ?? '',
    fimAlmoco: partial?.fimAlmoco ?? '',
    fim: partial?.fim ?? '',
  }
}

function diaUtilPadrao(): HorarioDia {
  return horarioDiaPadrao({
    aberto: true,
    inicio: '07:30',
    inicioAlmoco: '12:00',
    fimAlmoco: '13:30',
    fim: '17:30',
  })
}

function horariosPadrao(): CanalHorarios {
  const out = {} as CanalHorarios
  for (const dia of CANAL_HORARIO_DIAS) {
    if (dia === 'domingo') {
      out[dia] = horarioDiaPadrao({
        aberto: false,
        inicio: '08:00',
        fim: '12:00',
      })
    } else if (dia === 'sabado') {
      out[dia] = horarioDiaPadrao({
        aberto: true,
        inicio: '08:00',
        fim: '13:00',
      })
    } else {
      out[dia] = diaUtilPadrao()
    }
  }
  return out
}

function normalizarHorarioParaInput(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const t = valor.trim()
  if (!t) return ''
  const match = /^(\d{2}:\d{2})/.exec(t)
  return match?.[1] ?? t
}

function normalizarBooleano(valor: unknown, fallback: boolean): boolean {
  if (typeof valor === 'boolean') return valor
  if (valor === 'true') return true
  if (valor === 'false') return false
  return fallback
}

function clonarHorarios(raw: CanalHorarios): CanalHorarios {
  return ordenarCanalHorarios(JSON.parse(JSON.stringify(raw)) as CanalHorarios)
}

function horariosFromCanal(raw: CanalHorarios | null | undefined): CanalHorarios {
  const padrao = horariosPadrao()
  if (!raw) return padrao

  const cloneDia = (dia: CanalHorarioDia | undefined, fallback: HorarioDia): HorarioDia => ({
    aberto: normalizarBooleano(dia?.aberto, fallback.aberto),
    inicio: normalizarHorarioParaInput(dia?.inicio) || fallback.inicio,
    inicioAlmoco: normalizarHorarioParaInput(dia?.inicioAlmoco),
    fimAlmoco: normalizarHorarioParaInput(dia?.fimAlmoco),
    fim: normalizarHorarioParaInput(dia?.fim) || fallback.fim,
  })

  // Legado: { semana, sabado, domingo } → expande semana em seg–sex
  const rawObj = raw as Record<string, CanalHorarioDia | undefined> & {
    semana?: CanalHorarioDia
  }
  if (rawObj.semana && rawObj.segunda == null) {
    const semana = cloneDia(rawObj.semana, padrao.segunda)
    return ordenarCanalHorarios({
      domingo: cloneDia(rawObj.domingo, padrao.domingo),
      segunda: { ...semana },
      terca: { ...semana },
      quarta: { ...semana },
      quinta: { ...semana },
      sexta: { ...semana },
      sabado: cloneDia(rawObj.sabado, padrao.sabado),
    })
  }

  const out = {} as CanalHorarios
  for (const dia of CANAL_HORARIO_DIAS) {
    out[dia] = cloneDia(rawObj[dia], padrao[dia])
  }
  return out
}

function formatarCoordenada(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return String(valor)
}

function formatarValorPedidoMinimo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '0'
  const s = String(Math.round(valor * 100) / 100)
  return s.includes('.') ? s.replace('.', ',') : s
}

function formatarDataCriacao(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Workspace atual (rota /workspaces/[id]/canais ou contexto do chat). */
    workspaceId: number
    /** `create`: fluxo atual. `edit`: preenche com dados do Pinia. */
    mode?: 'create' | 'edit'
    /** Id do canal em edição — dados lidos de `canaisStore.items`. */
    canalEdicaoId?: number | null
  }>(),
  {
    mode: 'create',
    canalEdicaoId: null
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  criado: [payload: CanalCriado]
}>()

const canaisStore = useCanaisStore()
const kanbanStore = useKanbanStore()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const isEdit = computed(() => props.mode === 'edit')

/** Canal em edição — sempre resolvido a partir de `canaisStore.items`. */
const canalPinia = computed((): Canal | null => {
  const id = props.canalEdicaoId
  if (!isEdit.value || id == null) return null
  return canaisStore.items.find((c) => c.id === id) ?? null
})

const createdAtLabel = computed(() => formatarDataCriacao(canalPinia.value?.created_at))

const fieldIdSuffix = computed(() =>
  isEdit.value ? `edit-${props.canalEdicaoId ?? 'canal'}` : 'create',
)

function clonarFormasPagamento(raw?: CanalFormasPagamento | null): CanalFormasPagamento {
  const base = JSON.parse(JSON.stringify(CANAL_FORMAS_PAGAMENTO_PADRAO)) as CanalFormasPagamento
  if (!raw) return base
  return {
    online: { ...base.online, ...raw.online },
    entrega: { ...base.entrega, ...raw.entrega },
  }
}

type FollowLinha = {
  id: string
  minutos: string
  mensagem_fixa: boolean
  tipo: CanalFollowUpTipoMidia
  conteudo: string
  media_url: string
  arquivo: File | null
  previewLocal: string
  /** Só o `labelid` da etiqueta. */
  etiquetaKey: string
}

function chaveWhatsappLabel(label: WhatsappLabelItem | null | undefined): string {
  if (!label) return ''
  const labelid = typeof label.labelid === 'string' ? label.labelid.trim() : ''
  if (labelid) return labelid
  const id = typeof label.id === 'string' ? label.id.trim() : ''
  if (id.includes(':')) return id.split(':').pop()?.trim() || ''
  return id
}

function labelIdSalvo(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return ''
    if (s.includes(':')) return s.split(':').pop()?.trim() || ''
    return s
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return chaveWhatsappLabel(raw as WhatsappLabelItem)
  }
  return ''
}

function followLinhaVazia(): FollowLinha {
  return {
    id: `fu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    minutos: '',
    mensagem_fixa: false,
    tipo: 'texto',
    conteudo: '',
    media_url: '',
    arquivo: null,
    previewLocal: '',
    etiquetaKey: '',
  }
}

function descartarPreviewFollow(linha: FollowLinha) {
  if (linha.previewLocal) URL.revokeObjectURL(linha.previewLocal)
  linha.previewLocal = ''
  linha.arquivo = null
}

function followUpParaLinhas(cfg: CanalConfigFollowUp | null | undefined): FollowLinha[] {
  const keys = Object.keys(cfg ?? {}).sort((a, b) => Number(a) - Number(b))
  return keys.map((k) => {
    const passo = cfg?.[k]
    return {
      id: `fu-${k}-${Math.random().toString(36).slice(2, 7)}`,
      minutos: String(passo?.minutos_espera ?? ''),
      mensagem_fixa: passo?.mensagem_fixa === true,
      tipo: passo?.tipo ?? 'texto',
      conteudo: typeof passo?.conteudo === 'string' ? passo.conteudo : '',
      media_url: typeof passo?.media_url === 'string' ? passo.media_url : '',
      arquivo: null,
      previewLocal: '',
      etiquetaKey: labelIdSalvo(passo?.etiqueta),
    }
  })
}

function linhasParaFollowUp(linhas: FollowLinha[]): CanalConfigFollowUp | string {
  const preenchidas = linhas.filter((l) => l.minutos.trim())
  const out: CanalConfigFollowUp = {}
  for (let i = 0; i < preenchidas.length; i++) {
    const linha = preenchidas[i]!
    const n = Number.parseInt(linha.minutos.trim(), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return `Minutos de espera inválidos no follow-up ${i + 1} (informe um inteiro >= 1).`
    }
    const etiqueta = labelIdSalvo(linha.etiquetaKey) || null
    if (!linha.mensagem_fixa) {
      out[String(i + 1)] = {
        minutos_espera: n,
        mensagem_fixa: false,
        etiqueta,
      }
      continue
    }
    const tipo = linha.tipo
    if (tipo === 'texto') {
      const texto = linha.conteudo.trim()
      if (!texto) {
        return `Informe o texto da mensagem fixa no follow-up ${i + 1}.`
      }
      out[String(i + 1)] = {
        minutos_espera: n,
        mensagem_fixa: true,
        tipo: 'texto',
        conteudo: texto,
        media_url: null,
        etiqueta,
      }
      continue
    }
    const media = linha.media_url.trim()
    if (!media && !linha.arquivo) {
      return `Envie o arquivo de mídia do follow-up ${i + 1} antes de salvar.`
    }
    out[String(i + 1)] = {
      minutos_espera: n,
      mensagem_fixa: true,
      tipo,
      conteudo: linha.conteudo.trim() || null,
      media_url: media || null,
      etiqueta,
    }
  }
  return out
}

async function resolverMidiasFollowUpAntesDeSalvar(): Promise<string | null> {
  for (let i = 0; i < followUpLinhas.value.length; i++) {
    const linha = followUpLinhas.value[i]!
    if (!linha.minutos.trim()) continue
    if (!linha.mensagem_fixa || linha.tipo === 'texto') continue
    if (!linha.arquivo) {
      if (!linha.media_url.trim()) {
        return `Envie o arquivo de mídia do follow-up ${i + 1} antes de salvar.`
      }
      continue
    }
    try {
      const data_base64 = await lerArquivoComoBase64(linha.arquivo)
      const res = await $fetch<{ media_url: string }>('/api/canais/enviarfollowupmidiaparablackblaze', {
        method: 'POST',
        body: {
          workspace_id: props.workspaceId,
          tipo: linha.tipo,
          mime: linha.arquivo.type || 'application/octet-stream',
          data_base64,
          filename: linha.arquivo.name,
        },
      })
      const url = res.media_url?.trim()
      if (!url) return `Falha ao enviar mídia do follow-up ${i + 1}.`
      linha.media_url = url
      descartarPreviewFollow(linha)
    } catch (err: unknown) {
      return mensagemErroApi(err) || `Falha ao enviar mídia do follow-up ${i + 1}.`
    }
  }
  return null
}

const nome = ref('')
const descricao = ref('')
const endereco = ref('')
const latitude = ref('')
const longitude = ref('')
const tempoAvisoMinutos = ref('30')
const valorPedidoMinimo = ref('0')
const horarios = ref(horariosPadrao())
const assinaturaIaNaMensagem = ref(false)
const botaoParaIniciarIa = ref(false)
const mensagemSaudacao = ref('')
const imagemSaudacaoUrl = ref('')
const imagemArquivo = ref<File | null>(null)
const imagemPreviewLocal = ref('')
const imagemRemovida = ref(false)
const enviandoImagem = ref(false)
const lojaSlug = ref('')
const formasPagamento = ref<CanalFormasPagamento>(clonarFormasPagamento())
const disparoAtivo = ref(false)
const followUpLinhas = ref<FollowLinha[]>([])
const followAtivoEmColunas = ref<CanalFollowAtivoEmColunas>([])
const regrasFollowUp = ref<CanalRegrasFollowUp>(CANAL_REGRAS_FOLLOW_UP_PADRAO)
type PalavraAtivacaoLinha = { id: string; texto: string }
function palavraAtivacaoVazia(): PalavraAtivacaoLinha {
  return {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto: '',
  }
}
function palavrasParaLinhas(lista: CanalPalavrasAtivacaoFollowUp | null | undefined): PalavraAtivacaoLinha[] {
  const itens = Array.isArray(lista) ? lista : []
  return itens
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .map((texto) => ({
      id: `pa-${Math.random().toString(36).slice(2, 9)}`,
      texto,
    }))
}
function linhasParaPalavras(linhas: PalavraAtivacaoLinha[]): CanalPalavrasAtivacaoFollowUp | string {
  const out: CanalPalavrasAtivacaoFollowUp = []
  const vistos = new Set<string>()
  for (let i = 0; i < linhas.length; i++) {
    const texto = linhas[i]!.texto.trim()
    if (!texto) continue
    if (texto.length > 200) {
      return `Palavra/frase ${i + 1} é longa demais (máx. 200 caracteres).`
    }
    const chave = texto.toLocaleLowerCase('pt-BR')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push(texto)
  }
  if (out.length > 50) return 'Informe no máximo 50 palavras/frases.'
  return out
}
const palavrasAtivacaoLinhas = ref<PalavraAtivacaoLinha[]>([])
/** Só o `labelid` da lista de atendimento. */
const listaAtendimentoKey = ref('')
/** Só o `labelid` da lista de finalizado. */
const listaFinalizadoKey = ref('')
/** Só o `labelid` da lista de transferência de atendimento. */
const listaTransferenciaKey = ref('')
/** Só o `labelid` da lista de pedido pronto. */
const listaPedidoProntoKey = ref('')
const enviandoFollowMidia = ref(false)
const labelsWhatsapp = ref<WhatsappLabelItem[]>([])
const labelsWhatsappPending = ref(false)
const labelsWhatsappErro = ref<string | null>(null)
const labelsWhatsappCarregadas = ref(false)
const labelFormAberto = ref(false)
const labelFormModo = ref<'criar' | 'editar'>('criar')
const labelFormLabelId = ref<string | null>(null)
const labelFormNome = ref('')
const labelFormCor = ref(2)
const labelFormPending = ref(false)

function labelPlaceholder(labelid: string): WhatsappLabelItem {
  return {
    id: labelid,
    name: `Etiqueta #${labelid}`,
    color: null,
    colorHex: null,
    labelid,
    owner: null,
    created: null,
    updated: null,
  }
}

const opcoesLabelsWhatsapp = computed(() => {
  const mapa = new Map<string, WhatsappLabelItem>()
  for (const label of labelsWhatsapp.value) {
    const chave = chaveWhatsappLabel(label)
    if (chave) mapa.set(chave, label)
  }
  const listaKey = labelIdSalvo(listaAtendimentoKey.value)
  if (listaKey && !mapa.has(listaKey)) mapa.set(listaKey, labelPlaceholder(listaKey))
  const finalizadoKey = labelIdSalvo(listaFinalizadoKey.value)
  if (finalizadoKey && !mapa.has(finalizadoKey)) {
    mapa.set(finalizadoKey, labelPlaceholder(finalizadoKey))
  }
  const transferenciaKey = labelIdSalvo(listaTransferenciaKey.value)
  if (transferenciaKey && !mapa.has(transferenciaKey)) {
    mapa.set(transferenciaKey, labelPlaceholder(transferenciaKey))
  }
  const pedidoProntoKey = labelIdSalvo(listaPedidoProntoKey.value)
  if (pedidoProntoKey && !mapa.has(pedidoProntoKey)) {
    mapa.set(pedidoProntoKey, labelPlaceholder(pedidoProntoKey))
  }
  for (const linha of followUpLinhas.value) {
    const chave = labelIdSalvo(linha.etiquetaKey)
    if (chave && !mapa.has(chave)) mapa.set(chave, labelPlaceholder(chave))
  }
  return Array.from(mapa.values())
})

function listaAtendimentoSelecionada(): string | null {
  return labelIdSalvo(listaAtendimentoKey.value) || null
}

function listaFinalizadoSelecionada(): string | null {
  return labelIdSalvo(listaFinalizadoKey.value) || null
}

function listaTransferenciaSelecionada(): string | null {
  return labelIdSalvo(listaTransferenciaKey.value) || null
}

function listaPedidoProntoSelecionada(): string | null {
  return labelIdSalvo(listaPedidoProntoKey.value) || null
}

function onChangeListaAtendimento(event: Event) {
  listaAtendimentoKey.value = labelIdSalvo((event.target as HTMLSelectElement).value)
}

function onChangeListaFinalizado(event: Event) {
  listaFinalizadoKey.value = labelIdSalvo((event.target as HTMLSelectElement).value)
}

function onChangeListaTransferencia(event: Event) {
  listaTransferenciaKey.value = labelIdSalvo((event.target as HTMLSelectElement).value)
}

function onChangeListaPedidoPronto(event: Event) {
  listaPedidoProntoKey.value = labelIdSalvo((event.target as HTMLSelectElement).value)
}

function onChangeEtiquetaFollow(linha: FollowLinha, event: Event) {
  linha.etiquetaKey = labelIdSalvo((event.target as HTMLSelectElement).value)
}

function adicionarPalavraAtivacao() {
  palavrasAtivacaoLinhas.value = [...palavrasAtivacaoLinhas.value, palavraAtivacaoVazia()]
}

function removerPalavraAtivacao(id: string) {
  palavrasAtivacaoLinhas.value = palavrasAtivacaoLinhas.value.filter((l) => l.id !== id)
}

/** Snapshot do canal no Pinia ao abrir o modal (restauração no cancelar/fechar). */
const snapshotCanal = ref<Canal | null>(null)
/** true após salvar com sucesso — não restaura o snapshot ao fechar. */
const edicaoCommitada = ref(false)
/** Evita loop ao preencher o form a partir do Pinia. */
let preenchendoDoPinia = false

function clonarCanal(canal: Canal): Canal {
  return JSON.parse(JSON.stringify(canal)) as Canal
}

function normalizarCoordenadaTexto(valor: string): string {
  return valor.trim().replace(',', '.').replace('−', '-')
}

function parseCoordenadaFormulario(valor: string, min: number, max: number): number | null {
  const n = Number.parseFloat(normalizarCoordenadaTexto(valor))
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function montarHorariosDoFormulario(): CanalHorarios {
  return clonarHorarios(horarios.value)
}

function idCanalEmEdicao(): number | null {
  const raw = props.canalEdicaoId ?? snapshotCanal.value?.id ?? null
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function canalNoPinia(): Canal | null {
  const id = idCanalEmEdicao()
  if (id == null) return null
  return canaisStore.items.find((c) => c.id === id) ?? null
}

function limparLabelsWhatsapp() {
  labelsWhatsapp.value = []
  labelsWhatsappPending.value = false
  labelsWhatsappErro.value = null
  labelsWhatsappCarregadas.value = false
  fecharFormLabel()
  labelFormPending.value = false
}

function idCanalParaLabels(): number | null {
  return idCanalEmEdicao() ?? canaisStore.currentCanalId ?? null
}

function fecharFormLabel() {
  labelFormAberto.value = false
  labelFormModo.value = 'criar'
  labelFormLabelId.value = null
  labelFormNome.value = ''
  labelFormCor.value = 2
}

function abrirCriarLabel() {
  if (idCanalParaLabels() == null) {
    toast.warning('Salve o canal antes de criar uma etiqueta.')
    return
  }
  labelFormModo.value = 'criar'
  labelFormLabelId.value = null
  labelFormNome.value = ''
  labelFormCor.value = 2
  labelFormAberto.value = true
}

function abrirEditarLabel(label: WhatsappLabelItem) {
  const labelid = label.labelid?.trim()
  if (!labelid) {
    toast.warning('Esta etiqueta não tem labelid para editar.')
    return
  }
  labelFormModo.value = 'editar'
  labelFormLabelId.value = labelid
  labelFormNome.value = label.name
  labelFormCor.value =
    typeof label.color === 'number' && label.color >= 0 && label.color <= 19 ? label.color : 2
  labelFormAberto.value = true
}

async function carregarListasDoWhatsapp(options?: { silencioso?: boolean }) {
  const id = idCanalParaLabels()
  if (id == null) {
    toast.warning('Salve o canal antes de buscar as listas do WhatsApp.')
    return
  }

  labelsWhatsappPending.value = true
  labelsWhatsappErro.value = null
  try {
    const res = await $fetch<ListasDoWhatsappResponse>('/api/canais/listas_do_whatsapp', {
      method: 'GET',
      query: { id_canal: id },
    })
    labelsWhatsapp.value = res.labels ?? []
    labelsWhatsappCarregadas.value = true
    if (!options?.silencioso && !labelsWhatsapp.value.length) {
      toast.message('Nenhuma lista encontrada neste WhatsApp.')
    }
  } catch (err: unknown) {
    labelsWhatsapp.value = []
    labelsWhatsappCarregadas.value = false
    const msg = mensagemErroApi(err)
    labelsWhatsappErro.value = msg
    if (!options?.silencioso) toast.error(msg, { duration: 8000 })
  } finally {
    labelsWhatsappPending.value = false
  }
}

async function salvarLabelWhatsapp() {
  const id = idCanalParaLabels()
  if (id == null) {
    toast.warning('Salve o canal antes de salvar a etiqueta.')
    return
  }
  const nome = labelFormNome.value.trim()
  if (!nome) {
    toast.warning('Informe o nome da etiqueta.')
    return
  }
  if (labelFormModo.value === 'editar' && !labelFormLabelId.value) {
    toast.warning('labelid inválido para edição.')
    return
  }

  labelFormPending.value = true
  try {
    if (labelFormModo.value === 'criar') {
      await $fetch<WhatsappLabelMutateResponse>('/api/canais/listas_do_whatsapp/criar', {
        method: 'POST',
        body: {
          id_canal: id,
          name: nome,
          color: labelFormCor.value,
        },
      })
      toast.success('Etiqueta criada.')
    } else {
      await $fetch<WhatsappLabelMutateResponse>('/api/canais/listas_do_whatsapp/editar', {
        method: 'POST',
        body: {
          id_canal: id,
          labelid: labelFormLabelId.value,
          name: nome,
          color: labelFormCor.value,
        },
      })
      toast.success('Etiqueta atualizada.')
    }
    fecharFormLabel()
    await carregarListasDoWhatsapp({ silencioso: true })
  } catch (err: unknown) {
    toast.error(mensagemErroApi(err), { duration: 8000 })
  } finally {
    labelFormPending.value = false
  }
}

/** Alterna o dia com replace imutável (garante reatividade + sync no Pinia). */
function toggleDiaAberto(key: CanalHorarioDiaKey) {
  const dia = horarios.value[key]
  horarios.value = {
    ...horarios.value,
    [key]: { ...dia, aberto: !dia.aberto },
  }
}

function toggleFormaOnline(key: keyof CanalFormasPagamentoOnline) {
  formasPagamento.value = {
    ...formasPagamento.value,
    online: {
      ...formasPagamento.value.online,
      [key]: !formasPagamento.value.online[key],
    },
  }
}

function toggleFormaEntrega(key: keyof CanalFormasPagamentoEntrega) {
  formasPagamento.value = {
    ...formasPagamento.value,
    entrega: {
      ...formasPagamento.value.entrega,
      [key]: !formasPagamento.value.entrega[key],
    },
  }
}

function adicionarFollowUp() {
  followUpLinhas.value = [...followUpLinhas.value, followLinhaVazia()]
}

function removerFollowUp(id: string) {
  const alvo = followUpLinhas.value.find((l) => l.id === id)
  if (alvo) descartarPreviewFollow(alvo)
  followUpLinhas.value = followUpLinhas.value.filter((l) => l.id !== id)
}

function onFollowArquivoChange(linha: FollowLinha, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  if (file.size > 25 * 1024 * 1024) {
    toast.warning('O arquivo pode ter no máximo 25MB.')
    return
  }
  descartarPreviewFollow(linha)
  linha.arquivo = file
  linha.previewLocal = URL.createObjectURL(file)
}

function limparFollowArquivo(linha: FollowLinha) {
  descartarPreviewFollow(linha)
  linha.media_url = ''
}

function clonarFollowColunas(lista: CanalFollowAtivoEmColunas | null | undefined): CanalFollowAtivoEmColunas {
  if (!Array.isArray(lista)) return []
  return lista
    .map((item) => ({
      funil_id: Number(item?.funil_id),
      coluna_id: Number(item?.coluna_id),
    }))
    .filter((item) => Number.isInteger(item.funil_id) && item.funil_id > 0 && Number.isInteger(item.coluna_id) && item.coluna_id > 0)
}

function colunaFollowMarcada(funilId: number, colunaId: number): boolean {
  return followAtivoEmColunas.value.some((item) => item.funil_id === funilId && item.coluna_id === colunaId)
}

function toggleFollowColuna(funilId: number, colunaId: number) {
  if (colunaFollowMarcada(funilId, colunaId)) {
    followAtivoEmColunas.value = followAtivoEmColunas.value.filter(
      (item) => !(item.funil_id === funilId && item.coluna_id === colunaId),
    )
    return
  }
  followAtivoEmColunas.value = [
    ...followAtivoEmColunas.value,
    { funil_id: funilId, coluna_id: colunaId },
  ]
}

/** Só busca funis se o Pinia ainda não tiver a lista deste workspace. */
async function carregarFunisSeVazio() {
  const wid = props.workspaceId
  if (!Number.isFinite(wid) || wid < 1) return
  if (kanbanStore.funisWorkspaceIdLoaded === wid) return
  try {
    await kanbanStore.ensureFunisLoaded(wid)
  } catch (err: unknown) {
    toast.error(mensagemErroApi(err))
  }
}

const MIMES_IMAGEM_SAUDACAO = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const previewImagemSaudacao = computed(() => {
  if (imagemPreviewLocal.value) return imagemPreviewLocal.value
  if (imagemRemovida.value) return ''
  return imagemSaudacaoUrl.value
})

function descartarArquivoImagemLocal() {
  if (imagemPreviewLocal.value.startsWith('blob:')) URL.revokeObjectURL(imagemPreviewLocal.value)
  imagemArquivo.value = null
  imagemPreviewLocal.value = ''
}

function onSelecionarImagemSaudacao(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const mime = (file.type || '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (!MIMES_IMAGEM_SAUDACAO.has(mime)) {
    toast.warning('Use uma imagem jpeg, png, webp ou gif.')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.warning('A imagem pode ter no máximo 10MB.')
    return
  }
  descartarArquivoImagemLocal()
  imagemArquivo.value = file
  imagemPreviewLocal.value = URL.createObjectURL(file)
  imagemRemovida.value = false
}

function removerImagemSaudacao() {
  descartarArquivoImagemLocal()
  imagemSaudacaoUrl.value = ''
  imagemRemovida.value = true
}

function lerArquivoComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes('base64,') ? result.split('base64,')[1] ?? '' : result
      if (!base64) reject(new Error('Não foi possível ler a imagem.'))
      else resolve(base64)
    }
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

/** Se houver arquivo novo, sobe no Blackblaze e devolve a URL. Sem arquivo, mantém a URL atual ou null se removida. */
async function resolverImagemSaudacaoUrl(): Promise<string | null> {
  const arquivo = imagemArquivo.value
  if (!arquivo) {
    if (imagemRemovida.value) return null
    return imagemSaudacaoUrl.value.trim() || null
  }
  const data_base64 = await lerArquivoComoBase64(arquivo)
  const res = await $fetch<{ imagem_url: string }>('/api/canais/enviarimagemparablackblaze', {
    method: 'POST',
    body: {
      workspace_id: props.workspaceId,
      mime: arquivo.type || 'image/jpeg',
      data_base64,
      filename: arquivo.name,
    },
  })
  const url = res.imagem_url?.trim()
  if (!url) throw new Error('Upload da imagem não devolveu a URL.')
  return url
}

onBeforeUnmount(descartarArquivoImagemLocal)

function buildConfigPayload():
  | {
      endereco: string | null
      latitude: number | null
      longitude: number | null
      tempo_aviso_minutos: number
      valor_pedido_minimo: number
      horarios: CanalHorarios
      assinatura_ia_na_mensagem: boolean
      botao_para_iniciar_ia: boolean
      mensagem_saudacao: string | null
      loja_slug: string | null
      formas_pagamento: CanalFormasPagamento
      disparo_ativo: boolean
      config_follow_up: CanalConfigFollowUp
      follow_ativo_em_colunas: CanalFollowAtivoEmColunas
      regras_follow_up: CanalRegrasFollowUp
      id_da_lista_de_atendimento_do_whatsapp: string | null
      id_lista_finalizado_do_whatsapp: string | null
      id_lista_transferencia_de_atendimento_whatsapp: string | null
      id_lista_pedido_pronto_whatsapp: string | null
      palavras_ativacao_follow_up: CanalPalavrasAtivacaoFollowUp
    }
  | string {
  const erroExtras = validarCamposExtras()
  if (erroExtras) return erroExtras

  const latRaw = latitude.value.trim()
  const lngRaw = longitude.value.trim()
  const avisoRaw = tempoAvisoMinutos.value.trim()
  const aviso = avisoRaw ? Number.parseInt(avisoRaw, 10) : 30
  const minimoRaw = valorPedidoMinimo.value.trim()
  const minimo = minimoRaw
    ? Number.parseFloat(minimoRaw.replace(',', '.'))
    : 0
  const follow = linhasParaFollowUp(followUpLinhas.value)
  if (typeof follow === 'string') return follow
  const palavras = linhasParaPalavras(palavrasAtivacaoLinhas.value)
  if (typeof palavras === 'string') return palavras

  return {
    endereco: endereco.value.trim() || null,
    latitude: latRaw ? parseCoordenadaFormulario(latitude.value, -90, 90) : null,
    longitude: lngRaw ? parseCoordenadaFormulario(longitude.value, -180, 180) : null,
    tempo_aviso_minutos: aviso,
    valor_pedido_minimo: Number.isFinite(minimo) ? Math.round(minimo * 100) / 100 : 0,
    horarios: montarHorariosDoFormulario(),
    assinatura_ia_na_mensagem: assinaturaIaNaMensagem.value,
    botao_para_iniciar_ia: botaoParaIniciarIa.value,
    mensagem_saudacao: mensagemSaudacao.value.trim() || null,
    loja_slug: lojaSlug.value.trim().toLowerCase() || null,
    formas_pagamento: clonarFormasPagamento(formasPagamento.value),
    disparo_ativo: disparoAtivo.value,
    config_follow_up: follow,
    follow_ativo_em_colunas: clonarFollowColunas(followAtivoEmColunas.value),
    regras_follow_up: regrasFollowUp.value,
    id_da_lista_de_atendimento_do_whatsapp: listaAtendimentoSelecionada(),
    id_lista_finalizado_do_whatsapp: listaFinalizadoSelecionada(),
    id_lista_transferencia_de_atendimento_whatsapp: listaTransferenciaSelecionada(),
    id_lista_pedido_pronto_whatsapp: listaPedidoProntoSelecionada(),
    palavras_ativacao_follow_up: palavras,
  }
}

/** Espelha o formulário no item do Pinia enquanto o modal de edição está aberto. */
function sincronizarFormularioNoPinia() {
  if (!isEdit.value || preenchendoDoPinia) return
  const id = idCanalEmEdicao()
  if (id == null) return
  const idx = canaisStore.items.findIndex((c) => c.id === id)
  if (idx === -1) return

  const atual = canaisStore.items[idx]
  if (!atual) return

  const latRaw = latitude.value.trim()
  const lngRaw = longitude.value.trim()
  const avisoRaw = tempoAvisoMinutos.value.trim()
  const aviso = avisoRaw ? Number.parseInt(avisoRaw, 10) : 30
  const minimoRaw = valorPedidoMinimo.value.trim()
  const minimo = minimoRaw
    ? Number.parseFloat(minimoRaw.replace(',', '.'))
    : 0

  const follow = linhasParaFollowUp(followUpLinhas.value)
  const palavras = linhasParaPalavras(palavrasAtivacaoLinhas.value)

  canaisStore.items[idx] = {
    ...atual,
    nome: nome.value.trim() || null,
    descricao: descricao.value.trim() || null,
    endereco: endereco.value.trim() || null,
    latitude: latRaw ? parseCoordenadaFormulario(latitude.value, -90, 90) : null,
    longitude: lngRaw ? parseCoordenadaFormulario(longitude.value, -180, 180) : null,
    tempo_aviso_minutos: Number.isFinite(aviso) ? aviso : atual.tempo_aviso_minutos,
    valor_pedido_minimo: Number.isFinite(minimo)
      ? Math.round(minimo * 100) / 100
      : atual.valor_pedido_minimo,
    horarios: montarHorariosDoFormulario(),
    assinatura_ia_na_mensagem: assinaturaIaNaMensagem.value,
    botao_para_iniciar_ia: botaoParaIniciarIa.value,
    mensagem_saudacao: mensagemSaudacao.value.trim() || null,
    imagem_saudacao: imagemRemovida.value
      ? null
      : imagemArquivo.value
        ? atual.imagem_saudacao
        : imagemSaudacaoUrl.value.trim() || null,
    loja_slug: lojaSlug.value.trim().toLowerCase() || null,
    formas_pagamento: clonarFormasPagamento(formasPagamento.value),
    disparo_ativo: disparoAtivo.value,
    config_follow_up: typeof follow === 'string' ? atual.config_follow_up : follow,
    follow_ativo_em_colunas: clonarFollowColunas(followAtivoEmColunas.value),
    regras_follow_up: regrasFollowUp.value,
    id_da_lista_de_atendimento_do_whatsapp: listaAtendimentoSelecionada(),
    id_lista_finalizado_do_whatsapp: listaFinalizadoSelecionada(),
    id_lista_transferencia_de_atendimento_whatsapp: listaTransferenciaSelecionada(),
    id_lista_pedido_pronto_whatsapp: listaPedidoProntoSelecionada(),
    palavras_ativacao_follow_up:
      typeof palavras === 'string' ? atual.palavras_ativacao_follow_up : palavras,
  }
}

function restaurarSnapshotNoPinia() {
  const snap = snapshotCanal.value
  if (!snap) return
  const idx = canaisStore.items.findIndex((c) => c.id === snap.id)
  if (idx === -1) return
  canaisStore.items[idx] = clonarCanal(snap)
}

function resetarCamposExtras() {
  endereco.value = ''
  latitude.value = ''
  longitude.value = ''
  tempoAvisoMinutos.value = '30'
  valorPedidoMinimo.value = '0'
  horarios.value = horariosPadrao()
  assinaturaIaNaMensagem.value = false
  botaoParaIniciarIa.value = false
  mensagemSaudacao.value = ''
  descartarArquivoImagemLocal()
  imagemSaudacaoUrl.value = ''
  imagemRemovida.value = false
  lojaSlug.value = ''
  formasPagamento.value = clonarFormasPagamento()
  disparoAtivo.value = false
  for (const linha of followUpLinhas.value) descartarPreviewFollow(linha)
  followUpLinhas.value = []
  followAtivoEmColunas.value = []
  regrasFollowUp.value = CANAL_REGRAS_FOLLOW_UP_PADRAO
  palavrasAtivacaoLinhas.value = []
  listaAtendimentoKey.value = ''
  listaFinalizadoKey.value = ''
  listaTransferenciaKey.value = ''
  listaPedidoProntoKey.value = ''
  limparLabelsWhatsapp()
}

function preencherDoPinia() {
  preenchendoDoPinia = true
  try {
    if (!isEdit.value) {
      nome.value = ''
      descricao.value = ''
      resetarCamposExtras()
      return
    }

    const canal = canalNoPinia() ?? snapshotCanal.value
    if (!canal) {
      limparFormulario()
      return
    }

    nome.value = canal.nome?.trim() ?? ''
    descricao.value = canal.descricao?.trim() ?? ''
    endereco.value = canal.endereco?.trim() ?? ''
    latitude.value = formatarCoordenada(canal.latitude)
    longitude.value = formatarCoordenada(canal.longitude)
    tempoAvisoMinutos.value = String(canal.tempo_aviso_minutos ?? 30)
    valorPedidoMinimo.value = formatarValorPedidoMinimo(canal.valor_pedido_minimo)
    horarios.value = horariosFromCanal(canal.horarios)
    assinaturaIaNaMensagem.value = canal.assinatura_ia_na_mensagem === true
    botaoParaIniciarIa.value = canal.botao_para_iniciar_ia === true
    mensagemSaudacao.value = canal.mensagem_saudacao?.trim() ?? ''
    descartarArquivoImagemLocal()
    imagemRemovida.value = false
    imagemSaudacaoUrl.value = canal.imagem_saudacao?.trim() ?? ''
    lojaSlug.value = canal.loja_slug?.trim() ?? ''
    formasPagamento.value = clonarFormasPagamento(canal.formas_pagamento)
    disparoAtivo.value = canal.disparo_ativo === true
    for (const linha of followUpLinhas.value) descartarPreviewFollow(linha)
    followUpLinhas.value = followUpParaLinhas(canal.config_follow_up)
    followAtivoEmColunas.value = clonarFollowColunas(canal.follow_ativo_em_colunas)
    regrasFollowUp.value =
      typeof canal.regras_follow_up === 'string'
        ? canal.regras_follow_up
        : CANAL_REGRAS_FOLLOW_UP_PADRAO
    palavrasAtivacaoLinhas.value = palavrasParaLinhas(canal.palavras_ativacao_follow_up)
    listaAtendimentoKey.value = labelIdSalvo(canal.id_da_lista_de_atendimento_do_whatsapp)
    listaFinalizadoKey.value = labelIdSalvo(canal.id_lista_finalizado_do_whatsapp)
    listaTransferenciaKey.value = labelIdSalvo(
      canal.id_lista_transferencia_de_atendimento_whatsapp,
    )
    listaPedidoProntoKey.value = labelIdSalvo(canal.id_lista_pedido_pronto_whatsapp)
  } finally {
    // nextTick seria melhor, mas microtask evita sync com form ainda “velho”
    queueMicrotask(() => {
      preenchendoDoPinia = false
    })
  }
}

function limparFormulario() {
  nome.value = ''
  descricao.value = ''
  resetarCamposExtras()
}

function abrirModal() {
  edicaoCommitada.value = false
  snapshotCanal.value = null

  if (isEdit.value && idCanalEmEdicao() != null) {
    const canal = canalNoPinia()
    if (canal) {
      // Snapshot do estado ORIGINAL (antes de qualquer draft)
      snapshotCanal.value = clonarCanal(canal)
    }
  }

  preencherDoPinia()
  void carregarFunisSeVazio()
  // Garante Pinia = formulário logo ao abrir
  queueMicrotask(() => {
    if (isOpen.value && isEdit.value) sincronizarFormularioNoPinia()
  })
}

function fecharModal() {
  if (isEdit.value && snapshotCanal.value && !edicaoCommitada.value) {
    restaurarSnapshotNoPinia()
  }
  snapshotCanal.value = null
  edicaoCommitada.value = false
  limparFormulario()
}

watch(isOpen, (aberto) => {
  if (aberto) abrirModal()
  else fecharModal()
})

watch(
  () => props.canalEdicaoId,
  (id, prev) => {
    if (!isOpen.value || !isEdit.value) return
    if (id == null || id === prev) return
    abrirModal()
  },
)

watch(
  [nome, descricao, endereco, latitude, longitude, tempoAvisoMinutos, valorPedidoMinimo, horarios, assinaturaIaNaMensagem, botaoParaIniciarIa, mensagemSaudacao, imagemSaudacaoUrl, imagemRemovida, lojaSlug, formasPagamento, disparoAtivo, followUpLinhas, followAtivoEmColunas, regrasFollowUp, palavrasAtivacaoLinhas, listaAtendimentoKey, listaFinalizadoKey, listaTransferenciaKey, listaPedidoProntoKey],
  () => {
    if (!isOpen.value || !isEdit.value) return
    sincronizarFormularioNoPinia()
  },
  { deep: true },
)

function horarioValido(valor: string): boolean {
  return /^\d{2}:\d{2}$/.test(valor.trim())
}

function coordenadaValida(valor: string, min: number, max: number): boolean {
  return parseCoordenadaFormulario(valor, min, max) != null
}

/** Valida o que está na tela (formulário). */
function validarCamposExtras(): string | null {
  if (latitude.value.trim() && !coordenadaValida(latitude.value, -90, 90)) {
    return 'Latitude inválida (entre -90 e 90).'
  }
  if (longitude.value.trim() && !coordenadaValida(longitude.value, -180, 180)) {
    return 'Longitude inválida (entre -180 e 180).'
  }

  if (tempoAvisoMinutos.value.trim()) {
    const aviso = Number.parseInt(tempoAvisoMinutos.value, 10)
    if (!Number.isFinite(aviso) || aviso < 0) {
      return 'Tempo de aviso inválido (informe minutos >= 0).'
    }
  }

  if (valorPedidoMinimo.value.trim()) {
    const minimo = Number.parseFloat(valorPedidoMinimo.value.replace(',', '.'))
    if (!Number.isFinite(minimo) || minimo < 0) {
      return 'Valor mínimo do pedido inválido (informe um número >= 0).'
    }
  }

  const slug = lojaSlug.value.trim().toLowerCase()
  if (slug && !/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    return 'Slug da loja inválido. Use letras minúsculas, números e hífen (sem hífen no início ou no fim).'
  }

  const followErro = linhasParaFollowUp(followUpLinhas.value)
  if (typeof followErro === 'string') return followErro

  for (const { key, label } of DIAS_HORARIO) {
    const dia = horarios.value[key]
    if (dia.inicio.trim() && !horarioValido(dia.inicio)) {
      return `Horário de abertura inválido (${label}).`
    }
    if (dia.fim.trim() && !horarioValido(dia.fim)) {
      return `Horário de fechamento inválido (${label}).`
    }

    const temInicioAlmoco = Boolean(dia.inicioAlmoco.trim())
    const temFimAlmoco = Boolean(dia.fimAlmoco.trim())
    if (temInicioAlmoco !== temFimAlmoco) {
      return `Preencha início e fim do almoço em ${label}, ou deixe os dois vazios.`
    }
    if (temInicioAlmoco && !horarioValido(dia.inicioAlmoco)) {
      return `Horário de início do almoço inválido (${label}).`
    }
    if (temFimAlmoco && !horarioValido(dia.fimAlmoco)) {
      return `Horário de fim do almoço inválido (${label}).`
    }
  }

  return null
}

const formularioValido = computed(() => Boolean(nome.value.trim()))

/** Mensagem do Nitro/ofetch em erros HTTP (403 assinatura, workspace, etc.). */
function mensagemErroApi(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const data = o.data as Record<string, unknown> | undefined
    if (data) {
      if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage
      if (typeof data.message === 'string' && data.message) return data.message
    }
    if (typeof o.statusMessage === 'string' && o.statusMessage) return o.statusMessage
    if (typeof o.message === 'string' && o.message && !o.message.startsWith('[')) return o.message
  }
  if (err instanceof Error && err.message) return err.message
  return isEdit.value ? 'Não foi possível salvar o canal.' : 'Não foi possível criar o canal.'
}

function close() {
  isOpen.value = false
}

async function onCreate() {
  const n = nome.value.trim()
  const d = descricao.value.trim()

  if (!n) {
    toast.warning('Informe o nome do canal.')
    return
  }

  enviandoFollowMidia.value = true
  try {
    const erroMidia = await resolverMidiasFollowUpAntesDeSalvar()
    if (erroMidia) {
      toast.warning(erroMidia)
      return
    }
  } finally {
    enviandoFollowMidia.value = false
  }

  const payload = buildConfigPayload()
  if (typeof payload === 'string') {
    toast.warning(payload)
    return
  }

  let imagem_saudacao: string | null
  enviandoImagem.value = true
  try {
    imagem_saudacao = await resolverImagemSaudacaoUrl()
  } catch (err: unknown) {
    toast.error(mensagemErroApi(err))
    return
  } finally {
    enviandoImagem.value = false
  }

  if (isEdit.value) {
    const idCanal = idCanalEmEdicao()
    if (!idCanal) {
      toast.error('Canal inválido para edição.')
      return
    }

    if (!Number.isFinite(props.workspaceId)) {
      toast.error('Workspace inválido.')
      return
    }

    // Último sync tela → Pinia, depois envia o clone da tela
    sincronizarFormularioNoPinia()

    try {
      await canaisStore.updateCanal({
        id_canal: idCanal,
        workspace_id: props.workspaceId,
        nome: n,
        descricao: d || null,
        endereco: payload.endereco,
        latitude: payload.latitude,
        longitude: payload.longitude,
        tempo_aviso_minutos: payload.tempo_aviso_minutos,
        valor_pedido_minimo: payload.valor_pedido_minimo,
        horarios: payload.horarios,
        assinatura_ia_na_mensagem: payload.assinatura_ia_na_mensagem,
        botao_para_iniciar_ia: payload.botao_para_iniciar_ia,
        mensagem_saudacao: payload.mensagem_saudacao,
        imagem_saudacao,
        loja_slug: payload.loja_slug,
        formas_pagamento: payload.formas_pagamento,
        disparo_ativo: payload.disparo_ativo,
        config_follow_up: payload.config_follow_up,
        follow_ativo_em_colunas: payload.follow_ativo_em_colunas,
        regras_follow_up: payload.regras_follow_up,
        id_da_lista_de_atendimento_do_whatsapp:
          payload.id_da_lista_de_atendimento_do_whatsapp,
        id_lista_finalizado_do_whatsapp: payload.id_lista_finalizado_do_whatsapp,
        id_lista_transferencia_de_atendimento_whatsapp:
          payload.id_lista_transferencia_de_atendimento_whatsapp,
        id_lista_pedido_pronto_whatsapp: payload.id_lista_pedido_pronto_whatsapp,
        palavras_ativacao_follow_up: payload.palavras_ativacao_follow_up,
      })
      edicaoCommitada.value = true
      snapshotCanal.value = null
      toast.success('Canal atualizado com sucesso.')
      close()
    } catch (err: unknown) {
      const msg = mensagemErroApi(err)
      toast.error(msg, { duration: 8000 })
    }
    return
  }

  if (!Number.isFinite(props.workspaceId)) {
    toast.error('Workspace inválido.')
    return
  }

  try {
    const created = await canaisStore.create({
      nome: n,
      descricao: d || null,
      workspace_id: props.workspaceId,
      endereco: payload.endereco,
      latitude: payload.latitude,
      longitude: payload.longitude,
      tempo_aviso_minutos: payload.tempo_aviso_minutos,
      valor_pedido_minimo: payload.valor_pedido_minimo,
      horarios: payload.horarios,
      assinatura_ia_na_mensagem: payload.assinatura_ia_na_mensagem,
      botao_para_iniciar_ia: payload.botao_para_iniciar_ia,
      mensagem_saudacao: payload.mensagem_saudacao,
      imagem_saudacao,
      loja_slug: payload.loja_slug,
      formas_pagamento: payload.formas_pagamento,
      disparo_ativo: payload.disparo_ativo,
      config_follow_up: payload.config_follow_up,
      follow_ativo_em_colunas: payload.follow_ativo_em_colunas,
      regras_follow_up: payload.regras_follow_up,
      id_da_lista_de_atendimento_do_whatsapp:
        payload.id_da_lista_de_atendimento_do_whatsapp,
      id_lista_finalizado_do_whatsapp: payload.id_lista_finalizado_do_whatsapp,
      id_lista_transferencia_de_atendimento_whatsapp:
        payload.id_lista_transferencia_de_atendimento_whatsapp,
      id_lista_pedido_pronto_whatsapp: payload.id_lista_pedido_pronto_whatsapp,
      palavras_ativacao_follow_up: payload.palavras_ativacao_follow_up,
    })
    toast.success('Canal criado com sucesso.')
    emit('criado', created)
    close()
  } catch (err: unknown) {
    const msg = mensagemErroApi(err)
    toast.error(msg, {
      duration: 8000
    })
  }
}

</script>

<template>
  <BaseModal
    v-model:open="isOpen"
    :title="isEdit ? 'Editar canal' : 'Criar canal'"
    panel-class="w-full max-w-3xl"
  >
    <template #icon>
      <FontAwesomeIcon :icon="faWhatsapp" class="h-6 w-6 text-[#25D366]" aria-hidden="true" />
    </template>
    <template #subtitle>
      <template v-if="isEdit">
        Altere os dados do canal de atendimento e da loja.
        <span v-if="createdAtLabel" class="mt-1 block text-xs font-normal text-on-surface-variant dark:text-dark-on-surface-variant">
          Criado em {{ createdAtLabel }}
          <template v-if="canalPinia?.id"> · #{{ canalPinia.id }}</template>
        </span>
      </template>
      <template v-else>
        Preencha os dados do canal de atendimento e da loja.
      </template>
    </template>

    <div class="max-h-[min(70vh,42rem)] space-y-6 overflow-y-auto pr-1">
      <div class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-nome-${fieldIdSuffix}`">
            Nome <span class="text-error">*</span>
          </label>
          <BaseInput
            :id="`canal-nome-${fieldIdSuffix}`"
            v-model="nome"
            type="text"
            name="canal_nome"
            placeholder="Ex: Atendimento comercial"
            autocomplete="off"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-descricao-${fieldIdSuffix}`">
            Descrição
          </label>
          <textarea
            :id="`canal-descricao-${fieldIdSuffix}`"
            v-model="descricao"
            name="canal_descricao"
            rows="3"
            placeholder="Descreva o uso deste canal..."
            class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
          />
        </div>
      </div>

      <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Localização</h3>

          <div>
            <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-endereco-${fieldIdSuffix}`">
              Endereço da loja
            </label>
            <BaseInput
              :id="`canal-endereco-${fieldIdSuffix}`"
              v-model="endereco"
              type="text"
              name="canal_endereco"
              placeholder="Ex: Rua Exemplo, 123 — Bairro, Cidade - UF"
              autocomplete="street-address"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-latitude-${fieldIdSuffix}`">
                Latitude
              </label>
              <BaseInput
                :id="`canal-latitude-${fieldIdSuffix}`"
                v-model="latitude"
                type="text"
                name="canal_latitude"
                inputmode="decimal"
                placeholder="Ex: -23.550520"
                autocomplete="off"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-longitude-${fieldIdSuffix}`">
                Longitude
              </label>
              <BaseInput
                :id="`canal-longitude-${fieldIdSuffix}`"
                v-model="longitude"
                type="text"
                name="canal_longitude"
                inputmode="decimal"
                placeholder="Ex: -46.633308"
                autocomplete="off"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Configuração da loja</h3>

          <div>
            <label
              class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              :for="`canal-tempo-aviso-${fieldIdSuffix}`"
            >
              Tempo de aviso antes de fechar (minutos)
            </label>
            <BaseInput
              :id="`canal-tempo-aviso-${fieldIdSuffix}`"
              v-model="tempoAvisoMinutos"
              type="number"
              name="canal_tempo_aviso"
              inputmode="numeric"
              placeholder="Ex: 30"
              autocomplete="off"
            />
            <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Aviso enviado antes de fechar a loja ou iniciar o horário de almoço.
            </p>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              :for="`canal-valor-pedido-minimo-${fieldIdSuffix}`"
            >
              Valor mínimo do pedido (R$)
            </label>
            <BaseInput
              :id="`canal-valor-pedido-minimo-${fieldIdSuffix}`"
              v-model="valorPedidoMinimo"
              type="text"
              name="canal_valor_pedido_minimo"
              inputmode="decimal"
              placeholder="Ex: 30,00"
              autocomplete="off"
            />
            <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Use 0 se não houver valor mínimo. Aceita vírgula ou ponto.
            </p>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              :for="`canal-loja-slug-${fieldIdSuffix}`"
            >
              Slug da loja
            </label>
            <BaseInput
              :id="`canal-loja-slug-${fieldIdSuffix}`"
              v-model="lojaSlug"
              type="text"
              name="canal_loja_slug"
              placeholder="ex: minha-loja"
              autocomplete="off"
            />
            <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Opcional. Letras minúsculas, números e hífen. Deixe vazio se ainda não tiver loja pública.
            </p>
          </div>
        </div>

        <div class="space-y-3 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <div>
            <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">
              Horários de funcionamento
            </h3>
            <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Ative o dia para definir os horários. Sem almoço, deixe início e fim do almoço vazios.
            </p>
          </div>

          <div class="overflow-x-auto rounded-xl border border-outline-variant/20 dark:border-dark-outline/25">
            <div class="min-w-[40rem]">
              <!-- Cabeçalho (desktop) -->
              <div
                class="hidden grid-cols-[9.5rem_3.5rem_minmax(0,1fr)] gap-3 border-b border-outline-variant/15 bg-surface-container-low/60 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50 dark:text-dark-on-surface-variant sm:grid"
              >
                <span>Dia da semana</span>
                <span class="text-center">Ativo</span>
                <div class="grid grid-cols-4 gap-2">
                  <span>Início</span>
                  <span>Início almoço</span>
                  <span>Fim almoço</span>
                  <span>Final</span>
                </div>
              </div>

              <div
                v-for="{ key, label } in DIAS_HORARIO"
                :key="key"
                class="border-b border-outline-variant/10 px-3 py-3 last:border-b-0 dark:border-dark-outline/15"
              >
                <div
                  class="grid grid-cols-1 items-center gap-3 sm:grid-cols-[9.5rem_3.5rem_minmax(0,1fr)]"
                >
                  <p class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
                    {{ label }}
                  </p>

                  <div class="flex sm:justify-center">
                    <button
                      type="button"
                      role="switch"
                      :aria-checked="horarios[key].aberto"
                      :aria-label="`${label}: ${horarios[key].aberto ? 'aberto' : 'fechado'}`"
                      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      :class="
                        horarios[key].aberto
                          ? 'bg-primary'
                          : 'bg-slate-300 dark:bg-slate-600'
                      "
                      @click.stop="toggleDiaAberto(key)"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        :class="horarios[key].aberto ? 'translate-x-6' : 'translate-x-1'"
                      />
                    </button>
                  </div>

                  <div v-if="horarios[key].aberto" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-inicio-${fieldIdSuffix}`"
                      >
                        Início
                      </label>
                      <BaseInput
                        :id="`canal-${key}-inicio-${fieldIdSuffix}`"
                        v-model="horarios[key].inicio"
                        type="time"
                        :name="`canal_${key}_inicio`"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-inicio-almoco-${fieldIdSuffix}`"
                      >
                        Início almoço
                      </label>
                      <BaseInput
                        :id="`canal-${key}-inicio-almoco-${fieldIdSuffix}`"
                        v-model="horarios[key].inicioAlmoco"
                        type="time"
                        :name="`canal_${key}_inicio_almoco`"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-fim-almoco-${fieldIdSuffix}`"
                      >
                        Fim almoço
                      </label>
                      <BaseInput
                        :id="`canal-${key}-fim-almoco-${fieldIdSuffix}`"
                        v-model="horarios[key].fimAlmoco"
                        type="time"
                        :name="`canal_${key}_fim_almoco`"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-fim-${fieldIdSuffix}`"
                      >
                        Final
                      </label>
                      <BaseInput
                        :id="`canal-${key}-fim-${fieldIdSuffix}`"
                        v-model="horarios[key].fim"
                        type="time"
                        :name="`canal_${key}_fim`"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">I.A. e saudação</h3>

          <label class="flex items-center justify-between gap-3">
            <span class="text-sm text-on-surface dark:text-dark-on-surface">Assinatura da I.A. na mensagem</span>
            <button
              type="button"
              role="switch"
              :aria-checked="assinaturaIaNaMensagem"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              :class="assinaturaIaNaMensagem ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
              @click="assinaturaIaNaMensagem = !assinaturaIaNaMensagem"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="assinaturaIaNaMensagem ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span class="text-sm text-on-surface dark:text-dark-on-surface">Botão para iniciar a I.A.</span>
            <button
              type="button"
              role="switch"
              :aria-checked="botaoParaIniciarIa"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              :class="botaoParaIniciarIa ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
              @click="botaoParaIniciarIa = !botaoParaIniciarIa"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="botaoParaIniciarIa ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </label>

          <div>
            <label
              class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              :for="`canal-mensagem-saudacao-${fieldIdSuffix}`"
            >
              Mensagem de saudação
            </label>
            <BaseTextarea
              :id="`canal-mensagem-saudacao-${fieldIdSuffix}`"
              v-model="mensagemSaudacao"
              name="canal_mensagem_saudacao"
              :submit-on-enter="false"
              :min-height-px="88"
              :max-height-px="200"
              placeholder="Texto enviado ao iniciar o atendimento"
            />
          </div>

          <div>
            <p class="mb-2 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Imagem de saudação
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <img
                v-if="previewImagemSaudacao"
                :src="previewImagemSaudacao"
                alt="Prévia da imagem de saudação"
                class="h-20 w-20 rounded-xl object-cover ring-1 ring-outline-variant/30 dark:ring-dark-outline/40"
              >
              <div class="flex flex-wrap items-center gap-2">
                <label
                  class="inline-flex cursor-pointer items-center rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface ring-1 ring-outline-variant/30 hover:bg-surface-container-high dark:bg-dark-surface-container dark:text-dark-on-surface dark:ring-dark-outline/40 dark:hover:bg-dark-surface-container-high"
                  :for="`canal-imagem-saudacao-${fieldIdSuffix}`"
                >
                  Selecionar imagem
                </label>
                <input
                  :id="`canal-imagem-saudacao-${fieldIdSuffix}`"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="sr-only"
                  @change="onSelecionarImagemSaudacao"
                >
                <button
                  v-if="previewImagemSaudacao"
                  type="button"
                  class="text-sm font-semibold text-error"
                  @click="removerImagemSaudacao"
                >
                  Remover
                </button>
              </div>
            </div>
            <p class="mt-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              JPEG, PNG, WEBP ou GIF. Máximo 10MB.
            </p>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Formas de pagamento</h3>

          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Online
            </p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                v-for="opt in CANAL_FORMAS_ONLINE"
                :key="`online-${opt.key}`"
                class="flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-primary"
                  :checked="formasPagamento.online[opt.key]"
                  @change="toggleFormaOnline(opt.key)"
                >
                {{ opt.label }}
              </label>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Na entrega
            </p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                v-for="opt in CANAL_FORMAS_ENTREGA"
                :key="`entrega-${opt.key}`"
                class="flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-primary"
                  :checked="formasPagamento.entrega[opt.key]"
                  @change="toggleFormaEntrega(opt.key)"
                >
                {{ opt.label }}
              </label>
            </div>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Disparo e follow-up</h3>
              <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Cada passo vira a chave 1, 2, 3… com minutos, mensagem da I.A. ou fixa (texto/mídia).
              </p>
            </div>
            <div class="flex items-center gap-3">
              <BaseButton
                type="button"
                variant="secondary"
                size="sm"
                :block="false"
                class="!px-3"
                :disabled="labelsWhatsappPending"
                @click="carregarListasDoWhatsapp"
              >
                {{ labelsWhatsappPending ? 'Buscando…' : 'Listas do WhatsApp' }}
              </BaseButton>
              <button
                type="button"
                role="switch"
                :aria-checked="disparoAtivo"
                aria-label="Disparo ativo"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                :class="disparoAtivo ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
                @click="disparoAtivo = !disparoAtivo"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  :class="disparoAtivo ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>
          </div>

          <div
            v-if="labelsWhatsappErro || labelsWhatsappCarregadas || labelsWhatsappPending"
            class="space-y-3 rounded-2xl border border-outline-variant/20 p-3 dark:border-dark-outline/25"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
                Listas do WhatsApp
              </p>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-primary hover:bg-primary/10 disabled:opacity-50"
                aria-label="Criar etiqueta"
                title="Criar etiqueta"
                :disabled="labelsWhatsappPending || labelFormPending"
                @click="abrirCriarLabel"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              </button>
            </div>

            <div
              v-if="labelFormAberto"
              class="space-y-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-3 dark:border-dark-outline/30 dark:bg-dark-surface-container-lowest"
            >
              <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ labelFormModo === 'criar' ? 'Nova etiqueta' : `Editar etiqueta #${labelFormLabelId}` }}
              </p>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                  :for="`canal-label-nome-${fieldIdSuffix}`"
                >
                  Nome
                </label>
                <BaseInput
                  :id="`canal-label-nome-${fieldIdSuffix}`"
                  v-model="labelFormNome"
                  name="canal_label_nome"
                  placeholder="Ex: Para Atender"
                />
              </div>
              <div>
                <p class="mb-2 text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                  Cor
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="cor in WHATSAPP_LABEL_CORES"
                    :key="cor.value"
                    type="button"
                    class="h-7 w-7 rounded-full ring-offset-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    :class="labelFormCor === cor.value ? 'ring-2 ring-primary' : 'ring-1 ring-black/10'"
                    :style="{ backgroundColor: cor.hex }"
                    :title="`Cor ${cor.value}`"
                    :aria-label="`Cor ${cor.value}`"
                    @click="labelFormCor = cor.value"
                  />
                </div>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container dark:text-dark-on-surface-variant"
                  :disabled="labelFormPending"
                  @click="fecharFormLabel"
                >
                  Cancelar
                </button>
                <BaseButton
                  type="button"
                  size="sm"
                  :block="false"
                  class="!px-3"
                  :disabled="labelFormPending || !labelFormNome.trim()"
                  @click="salvarLabelWhatsapp"
                >
                  {{ labelFormPending ? 'Salvando…' : labelFormModo === 'criar' ? 'Criar' : 'Salvar' }}
                </BaseButton>
              </div>
            </div>

            <p
              v-if="labelsWhatsappPending"
              class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Carregando labels…
            </p>
            <p
              v-else-if="labelsWhatsappErro"
              class="text-sm text-error"
            >
              {{ labelsWhatsappErro }}
            </p>
            <ul
              v-else
              class="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <li
                v-for="label in labelsWhatsapp"
                :key="label.id"
                class="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface dark:bg-dark-surface-container dark:text-dark-on-surface"
              >
                <span
                  class="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                  :style="{ backgroundColor: label.colorHex || '#94a3b8' }"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 truncate font-medium">{{ label.name }}</span>
                <span
                  v-if="label.labelid"
                  class="shrink-0 text-[10px] tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  #{{ label.labelid }}
                </span>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-primary dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
                  :aria-label="`Editar ${label.name}`"
                  title="Editar etiqueta"
                  :disabled="labelFormPending"
                  @click="abrirEditarLabel(label)"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
                </button>
              </li>
              <li
                v-if="!labelsWhatsapp.length"
                class="col-span-full text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Nenhuma etiqueta neste WhatsApp. Use + para criar.
              </li>
            </ul>
          </div>

          <div>
            <label
              class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`canal-lista-atendimento-${fieldIdSuffix}`"
            >
              Lista de atendimento (única)
            </label>
            <select
              :id="`canal-lista-atendimento-${fieldIdSuffix}`"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
              :value="listaAtendimentoKey"
              @change="onChangeListaAtendimento"
            >
              <option value="">
                Nenhuma
              </option>
              <option
                v-for="label in opcoesLabelsWhatsapp"
                :key="`lista-${chaveWhatsappLabel(label)}`"
                :value="chaveWhatsappLabel(label)"
              >
                {{ label.name }}{{ label.labelid ? ` (#${label.labelid})` : '' }}
              </option>
            </select>
            <p class="mt-1 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Busque as listas do WhatsApp para escolher. Salva apenas o labelid.
            </p>
          </div>

          <div>
            <label
              class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`canal-lista-finalizado-${fieldIdSuffix}`"
            >
              Lista de finalizado (única)
            </label>
            <select
              :id="`canal-lista-finalizado-${fieldIdSuffix}`"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
              :value="listaFinalizadoKey"
              @change="onChangeListaFinalizado"
            >
              <option value="">
                Nenhuma
              </option>
              <option
                v-for="label in opcoesLabelsWhatsapp"
                :key="`finalizado-${chaveWhatsappLabel(label)}`"
                :value="chaveWhatsappLabel(label)"
              >
                {{ label.name }}{{ label.labelid ? ` (#${label.labelid})` : '' }}
              </option>
            </select>
            <p class="mt-1 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Etiqueta aplicada quando o atendimento é finalizado. Salva apenas o labelid.
            </p>
          </div>

          <div>
            <label
              class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`canal-lista-transferencia-${fieldIdSuffix}`"
            >
              Lista de transferência de atendimento (única)
            </label>
            <select
              :id="`canal-lista-transferencia-${fieldIdSuffix}`"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
              :value="listaTransferenciaKey"
              @change="onChangeListaTransferencia"
            >
              <option value="">
                Nenhuma
              </option>
              <option
                v-for="label in opcoesLabelsWhatsapp"
                :key="`transferencia-${chaveWhatsappLabel(label)}`"
                :value="chaveWhatsappLabel(label)"
              >
                {{ label.name }}{{ label.labelid ? ` (#${label.labelid})` : '' }}
              </option>
            </select>
            <p class="mt-1 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Etiqueta aplicada na transferência de atendimento. Salva apenas o labelid.
            </p>
          </div>

          <div>
            <label
              class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`canal-lista-pedido-pronto-${fieldIdSuffix}`"
            >
              Lista de pedido pronto (única)
            </label>
            <select
              :id="`canal-lista-pedido-pronto-${fieldIdSuffix}`"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
              :value="listaPedidoProntoKey"
              @change="onChangeListaPedidoPronto"
            >
              <option value="">
                Nenhuma
              </option>
              <option
                v-for="label in opcoesLabelsWhatsapp"
                :key="`pedido-pronto-${chaveWhatsappLabel(label)}`"
                :value="chaveWhatsappLabel(label)"
              >
                {{ label.name }}{{ label.labelid ? ` (#${label.labelid})` : '' }}
              </option>
            </select>
            <p class="mt-1 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Etiqueta aplicada quando o pedido fica pronto. Salva apenas o labelid.
            </p>
          </div>

          <div class="space-y-4">
            <div
              v-for="(linha, index) in followUpLinhas"
              :key="linha.id"
              class="space-y-3 rounded-2xl border border-outline-variant/20 p-3 dark:border-dark-outline/25"
            >
              <div class="flex items-end gap-2">
                <div class="w-10 shrink-0 pt-6 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                  {{ index + 1 }}
                </div>
                <div class="min-w-0 flex-1">
                  <label
                    class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                    :for="`canal-follow-${linha.id}`"
                  >
                    Minutos de espera
                  </label>
                  <BaseInput
                    :id="`canal-follow-${linha.id}`"
                    v-model="linha.minutos"
                    type="number"
                    :name="`canal_follow_${linha.id}`"
                    inputmode="numeric"
                    placeholder="Ex: 5"
                  />
                </div>
                <button
                  type="button"
                  class="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-error hover:bg-error/10"
                  :aria-label="`Remover follow-up ${index + 1}`"
                  @click="removerFollowUp(linha.id)"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
                </button>
              </div>

              <div>
                <label
                  class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                  :for="`canal-follow-etiqueta-${linha.id}`"
                >
                  Etiqueta desta etapa
                </label>
                <select
                  :id="`canal-follow-etiqueta-${linha.id}`"
                  class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
                  :value="linha.etiquetaKey"
                  @change="onChangeEtiquetaFollow(linha, $event)"
                >
                  <option value="">
                    Nenhuma
                  </option>
                  <option
                    v-for="label in opcoesLabelsWhatsapp"
                    :key="`fu-${linha.id}-${chaveWhatsappLabel(label)}`"
                    :value="chaveWhatsappLabel(label)"
                  >
                    {{ label.name }}{{ label.labelid ? ` (#${label.labelid})` : '' }}
                  </option>
                </select>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                  Mensagem
                </span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="linha.mensagem_fixa"
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                  :class="linha.mensagem_fixa ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
                  @click="linha.mensagem_fixa = !linha.mensagem_fixa"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    :class="linha.mensagem_fixa ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
                <span class="text-xs text-on-surface dark:text-dark-on-surface">
                  {{ linha.mensagem_fixa ? 'Fixa' : 'I.A. (contexto)' }}
                </span>
              </div>

              <template v-if="linha.mensagem_fixa">
                <div>
                  <label
                    class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                    :for="`canal-follow-tipo-${linha.id}`"
                  >
                    Tipo
                  </label>
                  <select
                    :id="`canal-follow-tipo-${linha.id}`"
                    v-model="linha.tipo"
                    class="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm text-on-surface dark:border-dark-outline/30 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
                  >
                    <option
                      v-for="opt in CANAL_FOLLOW_UP_TIPOS_MIDIA"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-if="linha.tipo === 'texto'">
                  <label
                    class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                    :for="`canal-follow-texto-${linha.id}`"
                  >
                    Texto da mensagem
                  </label>
                  <BaseTextarea
                    :id="`canal-follow-texto-${linha.id}`"
                    v-model="linha.conteudo"
                    :name="`canal_follow_texto_${linha.id}`"
                    rows="3"
                    placeholder="Mensagem fixa de follow-up…"
                  />
                </div>

                <div
                  v-else
                  class="space-y-2"
                >
                  <label
                    class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                    :for="`canal-follow-file-${linha.id}`"
                  >
                    Arquivo de mídia
                  </label>
                  <input
                    :id="`canal-follow-file-${linha.id}`"
                    type="file"
                    class="block w-full text-sm text-on-surface-variant file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
                    @change="onFollowArquivoChange(linha, $event)"
                  >
                  <p
                    v-if="linha.arquivo"
                    class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Novo arquivo: {{ linha.arquivo.name }}
                  </p>
                  <p
                    v-else-if="linha.media_url"
                    class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Já salvo: {{ linha.media_url }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <a
                      v-if="linha.media_url && !linha.arquivo"
                      :href="linha.media_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-medium text-primary hover:underline"
                    >
                      Abrir mídia atual
                    </a>
                    <button
                      v-if="linha.arquivo || linha.media_url"
                      type="button"
                      class="text-xs font-medium text-error hover:underline"
                      @click="limparFollowArquivo(linha)"
                    >
                      Remover arquivo
                    </button>
                  </div>
                  <div>
                    <label
                      class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                      :for="`canal-follow-caption-${linha.id}`"
                    >
                      Legenda (opcional)
                    </label>
                    <BaseInput
                      :id="`canal-follow-caption-${linha.id}`"
                      v-model="linha.conteudo"
                      :name="`canal_follow_caption_${linha.id}`"
                      placeholder="Caption…"
                    />
                  </div>
                </div>
              </template>
            </div>

            <div class="flex justify-end">
              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary hover:bg-primary/10"
                aria-label="Adicionar follow-up"
                @click="adicionarFollowUp"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              </button>
            </div>
          </div>

          <div class="space-y-3 border-t border-outline-variant/15 pt-4 dark:border-dark-outline/20">
            <div>
              <h4 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                Palavras de ativação do follow-up
              </h4>
              <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Frases ou palavras que ativam o follow-up. Aceita letras, números e emoji.
              </p>
            </div>

            <div
              v-for="(linha, index) in palavrasAtivacaoLinhas"
              :key="linha.id"
              class="flex items-end gap-2"
            >
              <div class="min-w-0 flex-1">
                <label
                  class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                  :for="`canal-palavra-ativacao-${linha.id}`"
                >
                  Frase {{ index + 1 }}
                </label>
                <BaseInput
                  :id="`canal-palavra-ativacao-${linha.id}`"
                  v-model="linha.texto"
                  :name="`canal_palavra_ativacao_${linha.id}`"
                  placeholder="Ex: quero orçamento"
                />
              </div>
              <button
                type="button"
                class="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-error hover:bg-error/10"
                :aria-label="`Remover frase ${index + 1}`"
                @click="removerPalavraAtivacao(linha.id)"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
              </button>
            </div>

            <div class="flex justify-end">
              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary hover:bg-primary/10"
                aria-label="Adicionar palavra de ativação"
                @click="adicionarPalavraAtivacao"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              </button>
            </div>
          </div>

          <div class="space-y-3 border-t border-outline-variant/15 pt-4 dark:border-dark-outline/20">
            <div>
              <h4 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                Regras de follow-up
              </h4>
              <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Oriente a I.A. sobre quando fazer e quando não fazer o follow-up.
              </p>
            </div>
            <div>
              <label
                class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                :for="`canal-regras-follow-up-${fieldIdSuffix}`"
              >
                Regras
              </label>
              <BaseTextarea
                :id="`canal-regras-follow-up-${fieldIdSuffix}`"
                v-model="regrasFollowUp"
                name="regras_follow_up"
                rows="8"
              />
            </div>
          </div>

          <div class="space-y-3 border-t border-outline-variant/15 pt-4 dark:border-dark-outline/20">
            <div>
              <h4 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                Follow-up ativo nas colunas
              </h4>
              <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Marque as colunas do kanban. Só o funil e a coluna selecionados são salvos.
              </p>
            </div>

            <p
              v-if="kanbanStore.funisPending"
              class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Carregando funis…
            </p>
            <p
              v-else-if="!kanbanStore.funis.length"
              class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Nenhum funil neste workspace.
            </p>

            <div
              v-for="funil in kanbanStore.funis"
              :key="funil.id"
              class="space-y-2"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ funil.nome }}
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  v-for="coluna in funil.columns"
                  :key="coluna.id"
                  class="flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-primary"
                    :checked="colunaFollowMarcada(funil.id, coluna.id)"
                    @change="toggleFollowColuna(funil.id, coluna.id)"
                  >
                  {{ coluna.nome }}
                </label>
              </div>
              <p
                v-if="!funil.columns.length"
                class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Este funil não tem colunas.
              </p>
            </div>
          </div>
        </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" @click="close">Cancelar</BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton
          type="button"
          :disabled="!formularioValido || canaisStore.pending || enviandoImagem || enviandoFollowMidia"
          @click="onCreate"
        >
          {{
            enviandoFollowMidia
              ? 'Enviando mídia…'
              : enviandoImagem
                ? 'Enviando imagem…'
                : isEdit
                  ? 'Salvar'
                  : 'Criar canal'
          }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
