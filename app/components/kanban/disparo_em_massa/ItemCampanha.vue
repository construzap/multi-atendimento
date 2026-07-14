<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  CampanhaListItem,
  CampanhaStatus,
  CampanhaStatusCriacao,
  AlterarStatusCampanhaResponse,
  AtualizarCampanhaResponse,
  ExcluirCampanhaResponse,
} from '#shared/types/disparoEmMassa'
import BaseButton from '~/components/BaseButton.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useDisparoEmMassaStore } from '~/stores/disparoEmMassa'
import { useKanbanStore } from '~/stores/kanban'

const props = defineProps<{
  campanha: CampanhaListItem
  workspaceId: number
}>()

const emit = defineEmits<{
  editar: [campanhaId: string]
  excluido: [campanhaId: string]
}>()

const disparoEmMassa = useDisparoEmMassaStore()
const canaisStore = useCanaisStore()
const kanbanStore = useKanbanStore()
const { items: canaisItems } = storeToRefs(canaisStore)
const { funis, columns: kanbanColumns } = storeToRefs(kanbanStore)

const modalExcluir = ref(false)
const excluindo = ref(false)
const alterandoStatus = ref(false)
const maisInfoAberto = ref(false)
const editandoAgendamento = ref(false)
const editData = ref('')
const editHora = ref('')
const salvandoAgendamento = ref(false)

const statusLabel: Record<CampanhaStatus, string> = {
  rascunho: 'Rascunho',
  processando: 'Processando',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

onMounted(() => {
  if (!import.meta.client || props.workspaceId < 1) return
  void canaisStore.ensureCanaisLoaded(props.workspaceId)
  void kanbanStore.ensureFunisLoaded(props.workspaceId)
})

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isoParaInputsLocais(iso: string | null | undefined): { data: string; hora: string } {
  if (!iso) return { data: '', hora: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { data: '', hora: '' }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return { data: `${yyyy}-${mm}-${dd}`, hora: `${hh}:${mi}` }
}

const usaProximoDisparo = computed(() => Boolean(props.campanha.proximo_disparo?.trim()))

const agendamentoIsoExibido = computed(
  () => (usaProximoDisparo.value ? props.campanha.proximo_disparo : props.campanha.data_inicio) ?? null,
)

const agendamentoLabel = computed(() =>
  usaProximoDisparo.value ? 'Próximo disparo' : 'Início',
)

function abrirEdicaoAgendamento() {
  const { data, hora } = isoParaInputsLocais(agendamentoIsoExibido.value)
  editData.value = data
  editHora.value = hora
  editandoAgendamento.value = true
}

function cancelarEdicaoAgendamento() {
  if (salvandoAgendamento.value) return
  editandoAgendamento.value = false
  editData.value = ''
  editHora.value = ''
}

async function salvarEdicaoAgendamento() {
  if (salvandoAgendamento.value) return
  if (!props.workspaceId || !props.campanha.id) return

  const data = editData.value.trim()
  const hora = editHora.value.trim()
  if (!data) {
    toast.error('Informe a data.')
    return
  }
  if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) {
    toast.error('Informe a hora.')
    return
  }

  salvandoAgendamento.value = true
  const campo: 'proximo_disparo' | 'data_inicio' = usaProximoDisparo.value
    ? 'proximo_disparo'
    : 'data_inicio'
  try {
    const response = await $fetch<AtualizarCampanhaResponse>('/api/kanban/disparo_em_massa', {
      method: 'PATCH',
      body: {
        workspace_id: props.workspaceId,
        campanha_id: props.campanha.id,
        somente_agendamento: true,
        campo_agendamento: campo,
        data_local: data,
        hora_local: hora,
      },
    })
    disparoEmMassa.atualizarCampanhaLocal(response.campanha)
    toast.success(
      campo === 'proximo_disparo' ? 'Próximo disparo atualizado.' : 'Data de início atualizada.',
    )
    editandoAgendamento.value = false
    editData.value = ''
    editHora.value = ''
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o agendamento.'))
  } finally {
    salvandoAgendamento.value = false
  }
}

function nomeCanalPorId(id: number): string {
  const canal = canaisItems.value.find((c) => c.id === id)
  const nome = canal?.nome?.trim()
  return nome || `Canal #${id}`
}

function nomeColunaPorId(colunaId: number | null | undefined): string {
  if (colunaId == null || !Number.isFinite(colunaId)) return '—'
  for (const funil of funis.value) {
    const col = funil.columns.find((c) => c.id === colunaId)
    if (col) {
      const nomeCol = col.nome?.trim() || `Coluna #${colunaId}`
      const nomeFunil = funil.nome?.trim()
      return nomeFunil ? `${nomeFunil} · ${nomeCol}` : nomeCol
    }
  }
  const colBoard = kanbanColumns.value.find((c) => c.id === colunaId)
  if (colBoard) return colBoard.nome?.trim() || `Coluna #${colunaId}`
  return `Coluna #${colunaId}`
}

const statusExibicao = computed(() => {
  const s = props.campanha.status
  if (!s) return '—'
  return statusLabel[s] ?? s
})

const tipoMensagem = computed(() => props.campanha.tipo_mensagem ?? 'texto')

const exibeMidiaVisual = computed(
  () => tipoMensagem.value === 'imagem' || tipoMensagem.value === 'video',
)

const legendaExibicao = computed(() => {
  const texto = (props.campanha.conteudo_texto ?? '').trim()
  return texto || 'sem legenda'
})

const textoExibicao = computed(() => {
  const texto = (props.campanha.conteudo_texto ?? '').trim()
  return texto || '—'
})

const exibeProgressoEnvio = computed(() => {
  const s = props.campanha.status
  return s === 'rascunho' || s === 'processando' || s === 'pausado'
})

const totalEnviados = computed(() => {
  const n = props.campanha.total_enviados
  return n != null && Number.isFinite(n) ? n : 0
})

const totalContatos = computed(() => {
  const n = props.campanha.total_contatos
  return n != null && Number.isFinite(n) ? n : 0
})

const iaLigadaLabel = computed(() => {
  if (props.campanha.ia_ligada === true) return 'Sim'
  if (props.campanha.ia_ligada === false) return 'Não'
  return '—'
})

const visualizacaoUnicaLabel = computed(() => {
  if (props.campanha.visualizacao_unica === true) return 'Sim'
  if (props.campanha.visualizacao_unica === false) return 'Não'
  return '—'
})

const canaisIdsLabel = computed(() => {
  const ids = props.campanha.canais_ids?.filter((id) => Number.isFinite(id) && id > 0) ?? []
  if (ids.length === 0 && props.campanha.canal_id != null) {
    return nomeCanalPorId(props.campanha.canal_id)
  }
  if (ids.length === 0) return '—'
  return ids.map((id) => nomeCanalPorId(id)).join(', ')
})

const fonteColunaLabel = computed(() => nomeColunaPorId(props.campanha.coluna_id))

const tamanhoLoteLabel = computed(() => {
  const n = props.campanha.tamanho_lote
  return n != null && Number.isFinite(n) ? String(n) : '—'
})

const pausaLoteLabel = computed(() => {
  const n = props.campanha.pausa_lote_minutos
  return n != null && Number.isFinite(n) ? `${n} min` : '—'
})

const statusAtualToggle = computed((): CampanhaStatusCriacao => {
  const s = props.campanha.status
  return s === 'processando' ? 'processando' : 'rascunho'
})

const campanhaLigada = computed(() => statusAtualToggle.value === 'processando')

const podeAlternarStatus = computed(() => props.campanha.status !== 'concluido')

async function alternarToggleStatus() {
  if (!podeAlternarStatus.value || alterandoStatus.value) return
  await alterarStatusCampanha(campanhaLigada.value ? 'rascunho' : 'processando')
}

async function alterarStatusCampanha(novoStatus: CampanhaStatusCriacao) {
  if (!podeAlternarStatus.value || alterandoStatus.value) return
  if (statusAtualToggle.value === novoStatus) return
  if (!props.workspaceId || !props.campanha.id) return

  alterandoStatus.value = true
  try {
    const data = await $fetch<AlterarStatusCampanhaResponse>('/api/kanban/disparo_em_massa/status', {
      method: 'PATCH',
      body: {
        workspace_id: props.workspaceId,
        campanha_id: props.campanha.id,
        status: novoStatus,
      },
    })
    disparoEmMassa.atualizarCampanhaLocal(data.campanha)
    toast.success(novoStatus === 'processando' ? 'Campanha ligada.' : 'Campanha desligada.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível alterar o status da campanha.'))
  } finally {
    alterandoStatus.value = false
  }
}

const textoConfirmarExclusao = computed(() => {
  const nome = props.campanha.nome?.trim() || 'Esta campanha'
  const avisoProcessando =
    props.campanha.status === 'processando'
      ? ' A campanha está em processamento e os envios pendentes serão cancelados.'
      : ''
  return `Excluir ${nome}? A fila de disparos será removida e esta ação não pode ser desfeita.${avisoProcessando}`
})

function onEditar() {
  emit('editar', props.campanha.id)
}

function abrirExcluir() {
  modalExcluir.value = true
}

async function confirmarExcluir() {
  if (!props.workspaceId || !props.campanha.id) {
    modalExcluir.value = false
    return
  }

  excluindo.value = true
  try {
    await $fetch<ExcluirCampanhaResponse>('/api/kanban/disparo_em_massa', {
      method: 'DELETE',
      query: {
        workspace_id: props.workspaceId,
        campanha_id: props.campanha.id,
      },
    })
    disparoEmMassa.removerCampanhaLocal(props.campanha.id)
    toast.success('Campanha excluída.')
    modalExcluir.value = false
    emit('excluido', props.campanha.id)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir a campanha.'))
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <article
    class="flex items-start gap-3 rounded-2xl border border-outline/30 bg-surface-container-lowest/90 p-4 shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container-low/80"
  >
    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate text-sm font-bold text-on-surface dark:text-dark-on-surface">
          {{ campanha.nome }}
        </h3>
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          :class="
            campanha.status === 'processando'
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-950/50 dark:text-black'
              : campanha.status === 'concluido'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-black'
                : campanha.status === 'pausado'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-black'
                  : 'bg-slate-600 text-white dark:bg-slate-600 dark:text-white'
          "
        >
          {{ statusExibicao }}
        </span>
        <button
          v-if="podeAlternarStatus"
          type="button"
          role="switch"
          :aria-checked="campanhaLigada"
          :disabled="alterandoStatus"
          aria-label="Ligar ou desligar campanha"
          class="flex h-6 w-11 shrink-0 items-center rounded-full border border-outline/50 px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 dark:border-dark-outline/50 dark:focus-visible:ring-dark-primary"
          :class="
            campanhaLigada
              ? 'justify-end bg-primary-600 dark:bg-primary-600'
              : 'justify-start bg-surface-container-highest dark:bg-dark-surface-container-highest'
          "
          @click="alternarToggleStatus"
        >
          <span
            class="pointer-events-none h-5 w-5 rounded-full bg-surface-container-lowest shadow dark:bg-dark-surface-container-low"
            aria-hidden="true"
          />
        </button>
      </div>

      <template v-if="exibeMidiaVisual">
        <div class="flex gap-3">
          <div
            v-if="campanha.url_midia"
            class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-outline/25 bg-surface-container-high dark:border-dark-outline/25 dark:bg-dark-surface-container-high"
          >
            <img
              v-if="tipoMensagem === 'imagem'"
              :src="campanha.url_midia"
              alt="Prévia da campanha"
              class="h-full w-full object-cover"
            />
            <video
              v-else
              :src="campanha.url_midia"
              class="h-full w-full object-cover"
              muted
              playsinline
              preload="metadata"
            />
          </div>
          <div
            v-else
            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline/35 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/35 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[22px]">
              {{ tipoMensagem === 'imagem' ? 'image' : 'videocam' }}
            </span>
          </div>

          <p
            class="min-w-0 flex-1 text-sm leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
            :class="legendaExibicao === 'sem legenda' ? 'italic opacity-80' : ''"
          >
            {{ legendaExibicao }}
          </p>
        </div>
      </template>

      <p
        v-else
        class="line-clamp-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ textoExibicao }}
      </p>

      <div class="space-y-1.5">
        <div
          v-if="!editandoAgendamento"
          class="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant/80 dark:text-dark-on-surface-variant/80"
        >
          <span>
            {{ agendamentoLabel }}: {{ formatarDataHora(agendamentoIsoExibido) }}
          </span>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary-700 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-primary-300"
            :aria-label="`Editar ${agendamentoLabel.toLowerCase()}`"
            @click="abrirEdicaoAgendamento"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
          </button>
        </div>

        <div
          v-else
          class="flex flex-wrap items-end gap-2 rounded-xl border border-outline/30 bg-surface-container-low/60 p-2 dark:border-dark-outline/30 dark:bg-dark-surface-container/50"
        >
          <div class="space-y-1">
            <label
              class="block text-[10px] font-semibold text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`campanha-edit-data-${campanha.id}`"
            >
              Data
            </label>
            <input
              :id="`campanha-edit-data-${campanha.id}`"
              v-model="editData"
              type="date"
              :disabled="salvandoAgendamento"
              class="rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            />
          </div>
          <div class="space-y-1">
            <label
              class="block text-[10px] font-semibold text-on-surface-variant dark:text-dark-on-surface-variant"
              :for="`campanha-edit-hora-${campanha.id}`"
            >
              Hora
            </label>
            <input
              :id="`campanha-edit-hora-${campanha.id}`"
              v-model="editHora"
              type="time"
              :disabled="salvandoAgendamento"
              class="rounded-lg border border-outline/40 bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface dark:[color-scheme:dark] dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            />
          </div>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            :disabled="salvandoAgendamento"
            @click="salvarEdicaoAgendamento"
          >
            {{ salvandoAgendamento ? 'Salvando…' : 'Salvar' }}
          </button>
          <button
            type="button"
            class="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
            :disabled="salvandoAgendamento"
            @click="cancelarEdicaoAgendamento"
          >
            Cancelar
          </button>
        </div>
      </div>

      <p
        v-if="exibeProgressoEnvio"
        class="text-xs font-medium text-primary-700 dark:text-primary-300"
      >
        Enviados: {{ totalEnviados }} / {{ totalContatos }} contato(s)
      </p>

      <div class="pt-1">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40"
          :aria-expanded="maisInfoAberto"
          @click="maisInfoAberto = !maisInfoAberto"
        >
          <span
            class="material-symbols-outlined text-[16px] transition-transform"
            :class="maisInfoAberto ? 'rotate-180' : ''"
            aria-hidden="true"
          >
            expand_more
          </span>
          Mais informações
        </button>

        <dl
          v-show="maisInfoAberto"
          class="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-outline/25 bg-surface-container-low/50 p-3 text-[11px] dark:border-dark-outline/25 dark:bg-dark-surface-container/40 sm:grid-cols-2"
        >
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              IA:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface">
              {{ iaLigadaLabel }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Início:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface">
              {{ formatarDataHora(campanha.data_inicio) }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Visualização única:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface">
              {{ visualizacaoUnicaLabel }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Canais:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface" :title="canaisIdsLabel">
              {{ canaisIdsLabel }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Tamanho do lote:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface">
              {{ tamanhoLoteLabel }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Pausa entre lotes:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface">
              {{ pausaLoteLabel }}
            </dd>
          </div>
          <div class="flex min-w-0 gap-1.5 sm:col-span-2">
            <dt class="shrink-0 font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
              Fonte:
            </dt>
            <dd class="min-w-0 truncate text-on-surface dark:text-dark-on-surface" :title="fonteColunaLabel">
              {{ fonteColunaLabel }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="flex shrink-0 flex-col gap-2">
      <BaseButton variant="secondary" :block="false" @click="onEditar">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
          Editar
        </span>
      </BaseButton>

      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-outline/30 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger-container/20 dark:border-dark-outline/30 dark:hover:bg-danger-container/10"
        aria-label="Excluir campanha"
        @click="abrirExcluir"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
        Excluir
      </button>
    </div>

    <ModalAlerta
      v-model:open="modalExcluir"
      title="Excluir campanha"
      :texto="textoConfirmarExclusao"
      variante="perigo"
      texto-confirmar="Excluir"
      :confirmar-desabilitado="excluindo"
      @confirmar="confirmarExcluir"
    />
  </article>
</template>
