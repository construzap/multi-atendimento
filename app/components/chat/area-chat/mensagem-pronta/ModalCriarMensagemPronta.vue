<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  AtualizarMensagemProntaResponse,
  CriarMensagemProntaResponse,
  MensagemProntaPasso,
  MensagemProntaPassoInput,
  MensagemProntaTipo,
} from '#shared/types/mensagensProntas'
import {
  CONTEUDO_PASSO_LIGACAO,
  DURACAO_LIGACAO_SEGUNDOS_DEFAULT,
  DURACAO_LIGACAO_SEGUNDOS_MAX,
  DURACAO_LIGACAO_SEGUNDOS_MIN,
} from '#shared/types/mensagensProntas'
import { VAR_PRIMEIRO_NOME, VAR_SAUDACAO } from '#shared/utils/mensagemProntaVariaveis'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useMensagensProntasStore } from '~/stores/mensagensProntas'
import { useWorkspacesStore } from '~/stores/workspaces'

type PassoForm = {
  key: string
  tipo: MensagemProntaTipo
  conteudo: string
  delay_segundos: number
  duracao_ligacao_segundos: number | null
  arquivo: File | null
  nomeArquivo: string | null
  previewUrl: string | null
}

type UploadMidiaResponse = {
  ok: true
  url: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Se informado, abre em modo edição dessa sequência. */
    sequenciaId?: string | null
  }>(),
  {
    sequenciaId: null,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Disparado após criar ou atualizar com sucesso. */
  salvo: [payload: CriarMensagemProntaResponse | AtualizarMensagemProntaResponse]
  close: []
}>()

const workspaces = useWorkspacesStore()
const mensagensProntasStore = useMensagensProntasStore()
const kanbanStore = useKanbanStore()
const { funis, funisPending } = storeToRefs(kanbanStore)
const pending = ref(false)
const nome = ref('')
const passos = ref<PassoForm[]>([novoPasso(0)])
/** Índice do passo em edição (só um formulário visível por vez). */
const passoAtivoIdx = ref(0)
/** Após os passos: mover contato para coluna do kanban (opcional). */
const moverContato = ref(false)
const funilDestinoId = ref<number | null>(null)
const colunaDestinoId = ref<number | null>(null)
/** I.A. ligada após o envio da sequência (default true, igual ao DB). */
const iaLigada = ref(true)
/** Fechar pedidos da I.A. em aberto após o envio (default false). */
const fecharPedidoEmAberto = ref(false)

/** Qual passo está gravando áudio (só um por vez). */
const gravandoPassoKey = ref<string | null>(null)

const fileInputRefs = ref<Record<string, HTMLInputElement | null>>({})
const textoAreaRef = ref<HTMLTextAreaElement | null>(null)

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

const tiposOpcao: { id: MensagemProntaTipo; label: string; icon: string }[] = [
  { id: 'texto', label: 'Texto', icon: 'chat' },
  { id: 'imagem', label: 'Imagem', icon: 'image' },
  { id: 'audio', label: 'Áudio', icon: 'mic' },
  { id: 'video', label: 'Vídeo', icon: 'movie' },
  { id: 'figurinha', label: 'Figurinha', icon: 'mood' },
  { id: 'ligacao', label: 'Ligação', icon: 'call' },
]

const iaOpcoes: { value: boolean; label: string; icon: string }[] = [
  { value: true, label: 'I.A. ligada', icon: 'smart_toy' },
  { value: false, label: 'I.A. desligada', icon: 'psychology_alt' },
]

const editando = computed(() => Boolean(props.sequenciaId?.trim()))

const tituloModal = computed(() =>
  editando.value ? 'Editar mensagem pronta' : 'Criar mensagem pronta',
)

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId
  if (raw == null || !String(raw).trim()) return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const passoAtivo = computed(() => passos.value[passoAtivoIdx.value] ?? null)

const colunasDoFunil = computed(() => {
  const fid = funilDestinoId.value
  if (fid == null) return []
  const funil = funis.value.find((f) => Number(f.id) === Number(fid))
  const cols = funil?.columns ?? []
  return [...cols].sort((a, b) => a.ordem - b.ordem)
})

/** Evita o watch de funil limpar a coluna durante a hidratação da edição. */
const hidratandoDestino = ref(false)

function novoPasso(delayDefault: number): PassoForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'texto',
    conteudo: '',
    delay_segundos: delayDefault,
    duracao_ligacao_segundos: null,
    arquivo: null,
    nomeArquivo: null,
    previewUrl: null,
  }
}

function passoFromExistente(p: MensagemProntaPasso, idx: number): PassoForm {
  const isMidia = p.tipo !== 'texto' && p.tipo !== 'ligacao'
  const duracaoRaw = Number(p.duracao_ligacao_segundos)
  return {
    key: p.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: p.tipo,
    conteudo: p.conteudo ?? '',
    delay_segundos: idx === 0 ? 0 : Math.max(0, Number(p.delay_segundos) || 0),
    duracao_ligacao_segundos:
      p.tipo === 'ligacao'
        ? Number.isFinite(duracaoRaw) && duracaoRaw >= DURACAO_LIGACAO_SEGUNDOS_MIN
          ? Math.min(DURACAO_LIGACAO_SEGUNDOS_MAX, Math.trunc(duracaoRaw))
          : DURACAO_LIGACAO_SEGUNDOS_DEFAULT
        : null,
    arquivo: null,
    nomeArquivo: isMidia ? 'Arquivo atual' : null,
    previewUrl: null,
  }
}

function midiaSrc(passo: PassoForm): string | null {
  if (passo.previewUrl) return passo.previewUrl
  if (passo.tipo === 'texto' || passo.tipo === 'ligacao') return null
  if (passo.conteudo.trim()) return passo.conteudo.trim()
  return null
}

function iconeTipo(tipo: MensagemProntaTipo): string {
  return tiposOpcao.find((t) => t.id === tipo)?.icon
    ?? (tipo === 'documento' ? 'description' : 'chat')
}

function labelTipo(tipo: MensagemProntaTipo): string {
  return tiposOpcao.find((t) => t.id === tipo)?.label
    ?? (tipo === 'documento' ? 'Documento' : 'Texto')
}

function classeSegmentoIa(ativo: boolean): string {
  return [
    'inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition disabled:opacity-50 sm:w-auto sm:flex-1',
    ativo
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-outline/35 bg-surface-container-lowest text-on-surface-variant hover:border-outline/60 dark:border-dark-outline/35 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant',
  ].join(' ')
}

function resumoPasso(passo: PassoForm): string {
  if (passo.tipo === 'texto') {
    const t = passo.conteudo.trim()
    return t || 'Sem texto'
  }
  if (passo.tipo === 'ligacao') {
    const s = Math.max(0, Number(passo.duracao_ligacao_segundos) || 0)
    return s > 0 ? `Toca por ${s}s` : 'Sem tempo'
  }
  if (passo.arquivo || passo.conteudo.trim()) {
    return passo.nomeArquivo?.trim() || 'Arquivo anexado'
  }
  return 'Sem arquivo'
}

function passoPreenchido(passo: PassoForm): boolean {
  if (passo.tipo === 'texto') return Boolean(passo.conteudo.trim())
  if (passo.tipo === 'ligacao') {
    const s = Number(passo.duracao_ligacao_segundos)
    return Number.isFinite(s) && s >= DURACAO_LIGACAO_SEGUNDOS_MIN
  }
  return Boolean(passo.arquivo || passo.conteudo.trim())
}

function revokePreview(passo: PassoForm) {
  if (passo.previewUrl) {
    globalThis.URL.revokeObjectURL(passo.previewUrl)
    passo.previewUrl = null
  }
}

function limparArquivoPasso(passo: PassoForm) {
  revokePreview(passo)
  passo.arquivo = null
  passo.nomeArquivo = null
  if (passo.tipo !== 'texto' && passo.tipo !== 'ligacao') passo.conteudo = ''
  const el = fileInputRefs.value[passo.key]
  if (el) el.value = ''
}

function resetForm() {
  if (isRecording.value) cancelRecording()
  gravandoPassoKey.value = null
  for (const p of passos.value) revokePreview(p)
  nome.value = ''
  passos.value = [novoPasso(0)]
  passoAtivoIdx.value = 0
  moverContato.value = false
  funilDestinoId.value = null
  colunaDestinoId.value = null
  iaLigada.value = true
  fecharPedidoEmAberto.value = false
  pending.value = false
}

function funilIdDaColuna(colunaId: number): number | null {
  return kanbanStore.findFunilIdByColunaId(colunaId)
}

async function garantirFunisCarregados() {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await kanbanStore.ensureFunisLoaded(wid)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os funis do kanban.'))
  }
}

/**
 * Restaura checkbox + funil + coluna a partir de `sequencia.coluna_destino_id`
 * (vindo do GET / mensagensProntas) batendo em `kanban.funis[].columns`.
 */
async function aplicarColunaDestinoSalva(colunaRaw: unknown) {
  const colId =
    colunaRaw == null || colunaRaw === ''
      ? null
      : Number(colunaRaw)
  if (colId == null || !Number.isFinite(colId) || colId < 1) {
    moverContato.value = false
    funilDestinoId.value = null
    colunaDestinoId.value = null
    return
  }

  await garantirFunisCarregados()

  hidratandoDestino.value = true
  try {
    const fid = funilIdDaColuna(colId)
    moverContato.value = true
    funilDestinoId.value = fid
    await nextTick()
    colunaDestinoId.value = colId
    if (fid == null) {
      toast.error('Coluna destino não encontrada nos funis deste workspace.')
    }
  } finally {
    hidratandoDestino.value = false
  }
}

async function hidratarEdicao(sequenciaId: string) {
  resetForm()
  const wid = workspaceId.value
  if (wid != null) {
    try {
      // Garante `coluna_destino_id` atualizado do GET antes de preencher o form.
      await mensagensProntasStore.refreshLista(wid)
    } catch (err: unknown) {
      toast.error(mensagemErroFetch(err, 'Não foi possível carregar a mensagem pronta.'))
      fechar()
      return
    }
  }

  const item = mensagensProntasStore.getById(sequenciaId)
  if (!item) {
    toast.error('Mensagem pronta não encontrada. Abra a lista novamente.')
    fechar()
    return
  }
  nome.value = item.sequencia.nome
  iaLigada.value = item.sequencia.ia_ligada !== false
  fecharPedidoEmAberto.value = item.sequencia.fechar_pedido_em_aberto === true
  const ordenados = [...item.passos].sort((a, b) => a.ordem - b.ordem)
  passos.value =
    ordenados.length > 0
      ? ordenados.map((p, idx) => passoFromExistente(p, idx))
      : [novoPasso(0)]
  passoAtivoIdx.value = 0

  await aplicarColunaDestinoSalva(item.sequencia.coluna_destino_id)
}

watch(
  () => [props.open, props.sequenciaId] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    const sid = props.sequenciaId?.trim()
    if (sid) await hidratarEdicao(sid)
    else {
      resetForm()
      void garantirFunisCarregados()
    }
  },
)

watch(moverContato, (on) => {
  if (hidratandoDestino.value) return
  if (!on) {
    funilDestinoId.value = null
    colunaDestinoId.value = null
  }
})

watch(funilDestinoId, () => {
  if (hidratandoDestino.value) return
  // Ao trocar funil, zera coluna se não pertencer mais.
  const col = colunaDestinoId.value
  if (col == null) return
  if (!colunasDoFunil.value.some((c) => Number(c.id) === Number(col))) {
    colunaDestinoId.value = null
  }
})

onUnmounted(() => {
  document.removeEventListener('paste', onPasteMidia)
  if (isRecording.value) cancelRecording()
  for (const p of passos.value) revokePreview(p)
})

watch(
  () => props.open,
  (aberto) => {
    if (aberto) {
      document.addEventListener('paste', onPasteMidia)
      return
    }
    document.removeEventListener('paste', onPasteMidia)
  },
  { immediate: true },
)

function fechar() {
  if (isRecording.value) cancelRecording()
  gravandoPassoKey.value = null
  emit('update:open', false)
  emit('close')
}

function selecionarPasso(idx: number) {
  if (idx < 0 || idx >= passos.value.length) return
  if (isRecording.value && gravandoPassoKey.value !== passos.value[idx]?.key) {
    toast.error('Finalize a gravação antes de trocar de passo.')
    return
  }
  passoAtivoIdx.value = idx
}

function adicionarPasso() {
  if (isRecording.value) {
    toast.error('Finalize a gravação antes de adicionar um passo.')
    return
  }
  passos.value.push(novoPasso(passos.value.length === 0 ? 0 : 5))
  passoAtivoIdx.value = passos.value.length - 1
}

function removerPasso(idx: number) {
  if (passos.value.length <= 1) return
  const removido = passos.value[idx]
  if (removido) {
    if (gravandoPassoKey.value === removido.key) {
      cancelRecording()
      gravandoPassoKey.value = null
    }
    revokePreview(removido)
  }
  passos.value.splice(idx, 1)
  if (passos.value[0]) passos.value[0].delay_segundos = 0
  if (passoAtivoIdx.value >= passos.value.length) {
    passoAtivoIdx.value = passos.value.length - 1
  } else if (passoAtivoIdx.value > idx) {
    passoAtivoIdx.value -= 1
  }
}

function setTipoPasso(passo: PassoForm, tipo: MensagemProntaTipo) {
  if (passo.tipo === tipo) return
  passo.tipo = tipo
  onTipoChange(passo)
}

function inserirVariavelNoTexto(token: string) {
  const passo = passoAtivo.value
  if (!passo || passo.tipo !== 'texto' || pending.value) return

  const el = textoAreaRef.value
  const atual = passo.conteudo ?? ''

  if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd
    passo.conteudo = `${atual.slice(0, start)}${token}${atual.slice(end)}`
    nextTick(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
    return
  }

  passo.conteudo = `${atual}${token}`
}

function inserirVariavelPrimeiroNome() {
  inserirVariavelNoTexto(VAR_PRIMEIRO_NOME)
}

function inserirVariavelSaudacao() {
  inserirVariavelNoTexto(VAR_SAUDACAO)
}

function onTipoChange(passo: PassoForm) {
  if (gravandoPassoKey.value === passo.key) {
    cancelRecording()
    gravandoPassoKey.value = null
  }
  limparArquivoPasso(passo)
  passo.conteudo = ''
  passo.duracao_ligacao_segundos =
    passo.tipo === 'ligacao' ? DURACAO_LIGACAO_SEGUNDOS_DEFAULT : null
}

function acceptParaTipo(tipo: MensagemProntaTipo): string {
  if (tipo === 'imagem') return 'image/jpeg,image/png,image/webp,image/gif'
  if (tipo === 'figurinha') return 'image/webp,image/png'
  if (tipo === 'audio') return 'audio/*'
  if (tipo === 'video') return 'video/mp4,video/quicktime,video/webm'
  return ''
}

function setFileInputRef(key: string, el: unknown) {
  fileInputRefs.value[key] = (el as HTMLInputElement | null) ?? null
}

function abrirSeletorArquivo(passo: PassoForm) {
  if (passo.tipo === 'texto' || passo.tipo === 'ligacao' || pending.value) return
  if (isRecording.value && gravandoPassoKey.value === passo.key) return
  fileInputRefs.value[passo.key]?.click()
}

function onArquivoChange(passo: PassoForm, ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return
  aplicarArquivoNoPasso(passo, file)
}

function mimePermitidoParaTipo(tipo: MensagemProntaTipo, mime: string): boolean {
  const m = (mime.split(';')[0] ?? '').trim().toLowerCase()
  if (!m.startsWith('image/')) return false
  if (tipo === 'imagem') {
    return m === 'image/jpeg' || m === 'image/png' || m === 'image/webp' || m === 'image/gif'
  }
  if (tipo === 'figurinha') {
    return m === 'image/webp' || m === 'image/png'
  }
  return false
}

function aplicarArquivoNoPasso(passo: PassoForm, file: File) {
  limparArquivoPasso(passo)
  passo.arquivo = file
  passo.nomeArquivo = file.name
  if (
    passo.tipo === 'imagem' ||
    passo.tipo === 'figurinha' ||
    passo.tipo === 'video' ||
    passo.tipo === 'audio'
  ) {
    passo.previewUrl = globalThis.URL.createObjectURL(file)
  }
}

function arquivoImagemDoClipboard(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

function onPasteMidia(ev: ClipboardEvent) {
  if (!props.open || pending.value) return

  const passo = passoAtivo.value
  if (!passo || (passo.tipo !== 'imagem' && passo.tipo !== 'figurinha')) return

  const target = ev.target as HTMLElement | null
  if (target) {
    const tag = target.tagName?.toLowerCase()
    if (tag === 'textarea' || (tag === 'input' && (target as HTMLInputElement).type === 'text')) {
      // Não intercepta colagem de texto no nome da sequência.
      return
    }
  }

  const file = arquivoImagemDoClipboard(ev.clipboardData?.items)
  if (!file) return

  if (!mimePermitidoParaTipo(passo.tipo, file.type)) {
    toast.error(
      passo.tipo === 'figurinha'
        ? 'Figurinha precisa ser WebP ou PNG.'
        : 'Formato de imagem não suportado (use jpeg, png, webp ou gif).',
    )
    ev.preventDefault()
    return
  }

  ev.preventDefault()
  aplicarArquivoNoPasso(passo, file)
  toast.success(passo.tipo === 'figurinha' ? 'Figurinha colada.' : 'Imagem colada.')
}

async function iniciarGravacao(passo: PassoForm) {
  if (passo.tipo !== 'audio' || pending.value) return
  if (isRecording.value) {
    toast.error('Finalize a gravação atual antes de iniciar outra.')
    return
  }
  limparArquivoPasso(passo)
  const ok = await startRecorder()
  if (ok) gravandoPassoKey.value = passo.key
}

async function confirmarGravacao(passo: PassoForm) {
  if (gravandoPassoKey.value !== passo.key || !isRecording.value) return
  const audio = await stopAndGetAudio()
  gravandoPassoKey.value = null
  if (!audio) return
  limparArquivoPasso(passo)
  passo.arquivo = audio.file
  passo.nomeArquivo = audio.file.name
  passo.previewUrl = globalThis.URL.createObjectURL(audio.file)
}

function cancelarGravacao(passo: PassoForm) {
  if (gravandoPassoKey.value !== passo.key) return
  cancelRecording()
  gravandoPassoKey.value = null
}

function estaGravandoPasso(passo: PassoForm): boolean {
  return isRecording.value && gravandoPassoKey.value === passo.key
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

async function uploadMidiaPasso(
  wid: number,
  tipo: Exclude<MensagemProntaTipo, 'texto' | 'ligacao'>,
  arquivo: File,
): Promise<string> {
  const part = await arquivoParaBase64Payload(arquivo)
  const up = await $fetch<UploadMidiaResponse>('/api/mensagens_prontas/upload-midia', {
    method: 'POST',
    body: {
      workspace_id: wid,
      tipo,
      mime: part.mime,
      data_base64: part.data_base64,
      filename: part.filename,
    },
  })
  return up.url
}

async function salvar() {
  if (pending.value) return

  if (isRecording.value) {
    toast.error('Finalize a gravação de áudio antes de salvar.')
    return
  }

  const nomeTrim = nome.value.trim()
  if (!nomeTrim) {
    toast.error('Informe o nome da sequência.')
    return
  }

  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Selecione um workspace.')
    return
  }

  for (let i = 0; i < passos.value.length; i++) {
    const p = passos.value[i]!
    if (p.tipo === 'ligacao') {
      const d = Math.trunc(Number(p.duracao_ligacao_segundos) || 0)
      if (d < DURACAO_LIGACAO_SEGUNDOS_MIN || d > DURACAO_LIGACAO_SEGUNDOS_MAX) {
        toast.error(
          `Informe o tempo da ligação no passo ${i + 1} (${DURACAO_LIGACAO_SEGUNDOS_MIN} a ${DURACAO_LIGACAO_SEGUNDOS_MAX} segundos).`,
        )
        selecionarPasso(i)
        return
      }
    } else if (p.tipo === 'texto') {
      if (!p.conteudo.trim()) {
        toast.error(`Preencha o texto do passo ${i + 1}.`)
        selecionarPasso(i)
        return
      }
    } else if (!p.arquivo && !p.conteudo.trim()) {
      toast.error(`Anexe um arquivo no passo ${i + 1} (${labelTipo(p.tipo)}).`)
      selecionarPasso(i)
      return
    }
  }

  let colunaDestino: number | null = null
  if (moverContato.value) {
    if (colunaDestinoId.value == null || colunaDestinoId.value < 1) {
      toast.error('Selecione a coluna do kanban para mover o contato, ou desmarque a opção.')
      return
    }
    colunaDestino = colunaDestinoId.value
  }

  pending.value = true
  try {
    const passosBody: MensagemProntaPassoInput[] = []

    for (let i = 0; i < passos.value.length; i++) {
      const p = passos.value[i]!
      const delay = Math.max(0, Math.trunc(Number(p.delay_segundos) || 0))
      let conteudo: string
      let duracao_ligacao_segundos: number | null = null

      if (p.tipo === 'ligacao') {
        conteudo = CONTEUDO_PASSO_LIGACAO
        duracao_ligacao_segundos = Math.trunc(Number(p.duracao_ligacao_segundos) || 0)
      } else if (p.tipo === 'texto') {
        conteudo = p.conteudo.trim()
      } else if (p.arquivo) {
        conteudo = await uploadMidiaPasso(wid, p.tipo, p.arquivo)
      } else {
        conteudo = p.conteudo.trim()
      }

      passosBody.push({
        ordem: i + 1,
        tipo: p.tipo,
        conteudo,
        delay_segundos: i === 0 ? 0 : delay,
        duracao_ligacao_segundos,
      })
    }

    const sid = props.sequenciaId?.trim()
    let res: CriarMensagemProntaResponse | AtualizarMensagemProntaResponse

    if (sid) {
      res = await mensagensProntasStore.atualizarSequencia({
        workspaceId: wid,
        sequenciaId: sid,
        nome: nomeTrim,
        passos: passosBody,
        coluna_destino_id: colunaDestino,
        ia_ligada: iaLigada.value,
        fechar_pedido_em_aberto: fecharPedidoEmAberto.value,
      })
      toast.success('Mensagem pronta atualizada.')
    } else {
      res = await mensagensProntasStore.criarSequencia({
        workspaceId: wid,
        nome: nomeTrim,
        passos: passosBody,
        coluna_destino_id: colunaDestino,
        ia_ligada: iaLigada.value,
        fechar_pedido_em_aberto: fecharPedidoEmAberto.value,
      })
      toast.success('Mensagem pronta criada.')
    }

    emit('salvo', res)
    fechar()
  } catch (err: unknown) {
    toast.error(
      mensagemErroFetch(
        err,
        editando.value
          ? 'Não foi possível atualizar a mensagem pronta.'
          : 'Não foi possível criar a mensagem pronta.',
      ),
    )
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="tituloModal"
    panel-class="w-full max-w-[720px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100vh-2rem)]"
    body-class="!p-3 sm:!p-5"
    @update:open="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-3 font-body text-on-surface sm:gap-4 dark:text-dark-on-surface">
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Nome da sequência
        </span>
        <input
          v-model="nome"
          type="text"
          maxlength="120"
          placeholder="Ex.: Boas-vindas"
          class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
        />
      </label>

      <div class="flex min-h-0 flex-col gap-3 sm:flex-row sm:items-start">
        <!-- Lista compacta de passos -->
        <aside
          class="flex shrink-0 flex-col gap-2 sm:w-[200px] sm:border-r sm:border-outline/25 sm:pr-3 dark:sm:border-dark-outline/25"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Passos
              <span class="font-mono tabular-nums text-on-surface/70">({{ passos.length }})</span>
            </p>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
              :disabled="pending || isRecording"
              aria-label="Adicionar passo"
              title="Adicionar passo"
              @click="adicionarPasso"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            </button>
          </div>

          <div class="flex max-h-24 gap-1.5 overflow-x-auto pb-1 sm:max-h-[min(36vh,260px)] sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:pb-0">
            <button
              v-for="(passo, idx) in passos"
              :key="passo.key"
              type="button"
              class="group flex min-w-[9.5rem] shrink-0 items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition sm:min-w-0 sm:w-full"
              :class="
                idx === passoAtivoIdx
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-outline/30 bg-surface-container-lowest hover:border-outline/50 dark:border-dark-outline/30 dark:bg-dark-surface-container-low'
              "
              @click="selecionarPasso(idx)"
            >
              <span
                class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                :class="
                  passoPreenchido(passo)
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high'
                "
              >
                {{ idx + 1 }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1 text-[11px] font-semibold">
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">
                    {{ iconeTipo(passo.tipo) }}
                  </span>
                  {{ labelTipo(passo.tipo) }}
                </span>
                <span class="mt-0.5 line-clamp-1 block text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant">
                  {{ resumoPasso(passo) }}
                </span>
                <span
                  v-if="idx > 0"
                  class="mt-0.5 block text-[10px] tabular-nums text-on-surface-variant/80 dark:text-dark-on-surface-variant/80"
                >
                  +{{ passo.delay_segundos || 0 }}s
                </span>
              </span>
            </button>
          </div>

          <button
            type="button"
            class="hidden items-center justify-center gap-1 rounded-lg border border-dashed border-outline/45 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-40 sm:inline-flex dark:border-dark-outline/45"
            :disabled="pending || isRecording"
            @click="adicionarPasso"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
            Novo passo
          </button>
        </aside>

        <!-- Editor do passo ativo -->
        <div v-if="passoAtivo" class="min-w-0 flex-1 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold">
              Passo {{ passoAtivoIdx + 1 }}
              <span class="font-normal text-on-surface-variant dark:text-dark-on-surface-variant">
                de {{ passos.length }}
              </span>
            </p>
            <button
              v-if="passos.length > 1"
              type="button"
              class="text-xs font-medium text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
              :disabled="pending"
              @click="removerPasso(passoAtivoIdx)"
            >
              Remover passo
            </button>
          </div>

          <div class="space-y-1.5">
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Tipo
            </span>
            <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              <button
                v-for="t in tiposOpcao"
                :key="t.id"
                type="button"
                class="flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-semibold transition disabled:opacity-50 sm:gap-1 sm:py-2 sm:text-[11px]"
                :class="
                  passoAtivo.tipo === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline/35 bg-surface-container-lowest text-on-surface-variant hover:border-outline/60 dark:border-dark-outline/35 dark:bg-dark-surface-container-low'
                "
                :disabled="pending || estaGravandoPasso(passoAtivo)"
                @click="setTipoPasso(passoAtivo, t.id)"
              >
                <span class="material-symbols-outlined text-[18px] sm:text-[20px]" aria-hidden="true">{{ t.icon }}</span>
                {{ t.label }}
              </button>
            </div>
          </div>

          <label v-if="passoAtivoIdx > 0" class="block space-y-1.5">
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Esperar antes de enviar (segundos)
            </span>
            <input
              v-model.number="passoAtivo.delay_segundos"
              type="number"
              min="0"
              step="1"
              :disabled="pending"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm tabular-nums dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            />
          </label>
          <p
            v-else
            class="text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Este é o primeiro passo — envia sem espera.
          </p>

          <!-- Ligação -->
          <div v-if="passoAtivo.tipo === 'ligacao'" class="space-y-2">
            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Tempo que a ligação toca (segundos)
              </span>
              <input
                v-model.number="passoAtivo.duracao_ligacao_segundos"
                type="number"
                :min="DURACAO_LIGACAO_SEGUNDOS_MIN"
                :max="DURACAO_LIGACAO_SEGUNDOS_MAX"
                step="1"
                :disabled="pending"
                class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm tabular-nums dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
              />
            </label>
            <div
              class="flex items-start gap-2 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <span
                class="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              >
                info
              </span>
              <p>
                Não será possível conversar nem ouvir nada durante essa ligação. Serve apenas para chamar a
                atenção do cliente.
              </p>
            </div>
          </div>

          <!-- Texto -->
          <div v-else-if="passoAtivo.tipo === 'texto'" class="space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Mensagem
              </span>
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1 text-[11px] font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:opacity-40 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
                  :disabled="pending"
                  title="Insere {primeiro-nome} no texto"
                  @click="inserirVariavelPrimeiroNome"
                >
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">person</span>
                  Primeiro nome
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1 text-[11px] font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:opacity-40 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
                  :disabled="pending"
                  title="Insere {saudacao} — Bom dia / Boa tarde / Boa noite conforme o horário do envio"
                  @click="inserirVariavelSaudacao"
                >
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">wb_twilight</span>
                  Saudação
                </button>
              </div>
            </div>
            <textarea
              ref="textoAreaRef"
              v-model="passoAtivo.conteudo"
              rows="5"
              placeholder="Ex.: {saudacao}, {primeiro-nome}, tudo bem?"
              :disabled="pending"
              class="w-full resize-y rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            />
            <p class="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant">
              <span class="font-mono">{primeiro-nome}</span> → primeiro nome do contato (ou vazio).
              <span class="font-mono">{saudacao}</span> → Bom dia / Boa tarde / Boa noite no horário do envio.
            </p>
          </div>

          <!-- Imagem / figurinha / vídeo -->
          <div
            v-else-if="passoAtivo.tipo === 'imagem' || passoAtivo.tipo === 'figurinha' || passoAtivo.tipo === 'video'"
            class="space-y-2"
          >
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              {{
                passoAtivo.tipo === 'imagem'
                  ? 'Imagem'
                  : passoAtivo.tipo === 'figurinha'
                    ? 'Figurinha'
                    : 'Vídeo'
              }}
            </span>
            <input
              :ref="(el) => setFileInputRef(passoAtivo.key, el)"
              class="hidden"
              type="file"
              :accept="acceptParaTipo(passoAtivo.tipo)"
              @change="onArquivoChange(passoAtivo, $event)"
            />

            <div
              v-if="passoAtivo.arquivo || midiaSrc(passoAtivo)"
              class="rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="truncate text-xs font-medium">{{ passoAtivo.nomeArquivo || 'Arquivo anexado' }}</p>
                <button
                  type="button"
                  class="shrink-0 text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline"
                  :disabled="pending"
                  @click="limparArquivoPasso(passoAtivo)"
                >
                  Remover
                </button>
              </div>
              <img
                v-if="(passoAtivo.tipo === 'imagem' || passoAtivo.tipo === 'figurinha') && midiaSrc(passoAtivo)"
                :src="midiaSrc(passoAtivo)!"
                alt="Prévia"
                class="max-h-36 rounded-md object-contain"
                :class="passoAtivo.tipo === 'figurinha' ? 'mx-auto' : ''"
              />
              <video
                v-else-if="passoAtivo.tipo === 'video' && midiaSrc(passoAtivo)"
                :src="midiaSrc(passoAtivo)!"
                controls
                class="max-h-36 w-full rounded-md"
              />
            </div>

            <button
              v-else
              type="button"
              class="inline-flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline/50 bg-surface-container-lowest px-3 py-5 text-sm font-medium text-on-surface-variant transition hover:border-primary hover:text-primary dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
              :disabled="pending"
              @click="abrirSeletorArquivo(passoAtivo)"
            >
              <span class="inline-flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
                {{
                  passoAtivo.tipo === 'figurinha'
                    ? 'Enviar figurinha (WebP ou PNG)'
                    : 'Enviar do dispositivo'
                }}
              </span>
              <span
                v-if="passoAtivo.tipo === 'imagem' || passoAtivo.tipo === 'figurinha'"
                class="text-[11px] font-normal text-on-surface-variant/80 dark:text-dark-on-surface-variant/80"
              >
                ou cole com Ctrl+V
              </span>
            </button>
            <p
              v-if="passoAtivo.tipo === 'figurinha'"
              class="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Preferencialmente WebP (formato de sticker do WhatsApp). Também dá para colar com Ctrl+V.
            </p>
            <p
              v-else-if="passoAtivo.tipo === 'imagem' && (passoAtivo.arquivo || midiaSrc(passoAtivo))"
              class="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Cole outra imagem com Ctrl+V para substituir.
            </p>
          </div>

          <!-- Áudio -->
          <div v-else-if="passoAtivo.tipo === 'audio'" class="space-y-2">
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Áudio
            </span>
            <input
              :ref="(el) => setFileInputRef(passoAtivo.key, el)"
              class="hidden"
              type="file"
              accept="audio/*"
              @change="onArquivoChange(passoAtivo, $event)"
            />

            <div
              v-if="estaGravandoPasso(passoAtivo)"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
            >
              <span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
              <span class="text-sm font-semibold">
                {{ isPaused ? 'Pausado' : 'Gravando…' }}
              </span>
              <span class="ml-auto font-mono text-sm tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ formatRecordTime(recordSeconds) }}
              </span>
              <div class="flex w-full items-center justify-end gap-2 pt-1 sm:w-auto sm:pt-0">
                <button
                  type="button"
                  class="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400"
                  aria-label="Cancelar gravação"
                  @click="cancelarGravacao(passoAtivo)"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
                </button>
                <button
                  type="button"
                  class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  :aria-label="isPaused ? 'Continuar gravação' : 'Pausar gravação'"
                  @click="togglePauseRecording"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {{ isPaused ? 'play_arrow' : 'pause' }}
                  </span>
                </button>
                <button
                  type="button"
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-md"
                  aria-label="Salvar áudio"
                  @click="confirmarGravacao(passoAtivo)"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">check</span>
                </button>
              </div>
            </div>

            <div
              v-else-if="passoAtivo.arquivo || midiaSrc(passoAtivo)"
              class="rounded-lg border border-outline/40 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="truncate text-xs font-medium">{{ passoAtivo.nomeArquivo || 'Áudio anexado' }}</p>
                <button
                  type="button"
                  class="shrink-0 text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline"
                  :disabled="pending"
                  @click="limparArquivoPasso(passoAtivo)"
                >
                  Remover
                </button>
              </div>
              <audio v-if="midiaSrc(passoAtivo)" :src="midiaSrc(passoAtivo)!" controls class="w-full" />
            </div>

            <div v-else class="flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-outline/50 bg-surface-container-lowest px-3 py-4 text-sm font-medium text-on-surface-variant transition hover:border-primary hover:text-primary dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
                :disabled="pending || isRecording"
                @click="abrirSeletorArquivo(passoAtivo)"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
                Do dispositivo
              </button>
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-outline/50 bg-surface-container-lowest px-3 py-4 text-sm font-medium text-on-surface-variant transition hover:border-primary hover:text-primary dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
                :disabled="pending || isRecording"
                @click="iniciarGravacao(passoAtivo)"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">mic</span>
                Gravar
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 dark:hover:bg-dark-surface-container-high"
              :disabled="passoAtivoIdx <= 0 || pending || isRecording"
              @click="selecionarPasso(passoAtivoIdx - 1)"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_left</span>
              Anterior
            </button>
            <button
              v-if="passoAtivoIdx < passos.length - 1"
              type="button"
              class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
              :disabled="pending || isRecording"
              @click="selecionarPasso(passoAtivoIdx + 1)"
            >
              Próximo
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
            </button>
            <button
              v-else
              type="button"
              class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
              :disabled="pending || isRecording"
              @click="adicionarPasso"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
              Adicionar passo
            </button>
          </div>
        </div>
      </div>

      <!-- Após os passos: I.A. + mover contato no kanban -->
      <div class="space-y-2.5 rounded-xl border border-outline/35 bg-surface-container-low/70 p-2.5 sm:space-y-3 sm:p-3 dark:border-dark-outline/35 dark:bg-dark-surface-container/50">
        <div class="space-y-2">
          <div>
            <p class="text-sm font-semibold">I.A. após o envio</p>
            <p class="mt-0.5 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Define se o atendimento automático fica ligado ou desligado nesta conversa após a sequência.
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="I.A. após o envio">
            <button
              v-for="opc in iaOpcoes"
              :key="String(opc.value)"
              type="button"
              :class="classeSegmentoIa(iaLigada === opc.value)"
              :aria-pressed="iaLigada === opc.value"
              :disabled="pending"
              @click="iaLigada = opc.value"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ opc.icon }}</span>
              {{ opc.label }}
            </button>
          </div>
        </div>

        <label class="flex cursor-pointer items-start gap-2.5 border-t border-outline/25 pt-3 dark:border-dark-outline/25">
          <input
            v-model="fecharPedidoEmAberto"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-outline/50 text-primary focus:ring-primary/30"
            :disabled="pending"
          />
          <span class="min-w-0">
            <span class="block text-sm font-semibold">Fechar pedidos da I.A. em aberto</span>
            <span class="mt-0.5 block text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Encerra pedidos/orçamentos da I.A. que ainda estiverem abertos para este contato após a sequência.
            </span>
          </span>
        </label>

        <label class="flex cursor-pointer items-start gap-2.5 border-t border-outline/25 pt-3 dark:border-dark-outline/25">
          <input
            v-model="moverContato"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-outline/50 text-primary focus:ring-primary/30"
            :disabled="pending"
          />
          <span class="min-w-0">
            <span class="block text-sm font-semibold">Após enviar todos os passos</span>
            <span class="mt-0.5 block text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Mover o contato para uma coluna do kanban (opcional).
            </span>
          </span>
        </label>

        <div v-if="moverContato" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="block space-y-1.5">
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Funil
            </span>
            <select
              :value="funilDestinoId ?? ''"
              :disabled="pending || funisPending"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
              @change="funilDestinoId = Number(($event.target as HTMLSelectElement).value) || null"
            >
              <option value="">
                {{ funisPending ? 'Carregando…' : 'Selecione o funil' }}
              </option>
              <option v-for="f in funis" :key="f.id" :value="f.id">{{ f.nome }}</option>
            </select>
          </label>

          <label class="block space-y-1.5">
            <span class="text-[11px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Coluna destino
            </span>
            <select
              :value="colunaDestinoId ?? ''"
              :disabled="pending || funilDestinoId == null || funisPending"
              class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 text-sm disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
              @change="colunaDestinoId = Number(($event.target as HTMLSelectElement).value) || null"
            >
              <option value="">Selecione a coluna</option>
              <option v-for="c in colunasDoFunil" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" :block="false" class="sm:mr-auto" :disabled="pending" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton variant="primary" :block="false" :disabled="pending || isRecording" @click="salvar">
        {{ pending ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
