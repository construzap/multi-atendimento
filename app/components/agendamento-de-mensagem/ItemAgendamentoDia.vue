<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import ModalAlerta from '~/components/ModalAlerta.vue'
import type { AgendamentoDiaItem } from '~/components/agendamento-de-mensagem/types'
import { intervaloRecorrenciaLabelPt } from '#shared/utils/agendamentoIntervaloPt'
import { mensagemErroFetch } from '~/stores/canais'

const props = defineProps<{
  item: AgendamentoDiaItem
  workspaceId: number
  onEdit?: (item: AgendamentoDiaItem) => void
}>()

const emit = defineEmits<{
  excluido: [item: AgendamentoDiaItem]
}>()

const modalExcluir = ref(false)
const excluindo = ref(false)

const tz = computed(() => props.item.iana_timezone?.trim() || 'America/Sao_Paulo')

function formatTimePtBr(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: tz.value,
    }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso))
  }
}

const nome = computed(() => (props.item.nomecliente ?? '').trim())
const telefone = computed(() => (props.item.telefone ?? '').trim())

const tipoLabel = computed(() => {
  const t = (props.item.mensagem_type ?? '').trim().toLowerCase()
  if (t === 'imagem') return 'Imagem'
  if (t === 'audio') return 'Áudio'
  if (t === 'texto') return 'Texto'
  return t || 'Texto'
})

const statusLabel = computed(() => (props.item.status ?? '').trim() || '—')

const recorrenteLabel = computed(() => {
  if (props.item.recorrente !== true) return 'Não'
  const lab = intervaloRecorrenciaLabelPt(props.item.intervalo_recorrencia ?? null)
  return lab ? `Sim · ${lab}` : 'Sim'
})

const mostrarTexto = computed(() => {
  const t = (props.item.mensagem_type ?? '').trim().toLowerCase()
  const txt = (props.item.mensagem_texto ?? '').trim()
  return txt.length > 0 && (t === 'texto' || t === '' || t === 'imagem' || t === 'audio')
})

const textoConfirmarExclusao = computed(() => {
  const hora = formatTimePtBr(props.item.data_agendada)
  const dest = nome.value || telefone.value || 'este agendamento'
  return `Excluir o agendamento das ${hora} para ${dest}? Esta ação não pode ser desfeita.`
})

function abrirExcluir() {
  modalExcluir.value = true
}

async function confirmarExcluir() {
  if (props.item.id < 1 || props.workspaceId < 1) {
    modalExcluir.value = false
    return
  }
  excluindo.value = true
  try {
    await $fetch(`/api/agendamento-de-mensagem/${props.item.id}`, {
      method: 'DELETE',
      query: { workspace_id: props.workspaceId },
    })
    toast.success('Agendamento excluído.')
    modalExcluir.value = false
    emit('excluido', props.item)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir o agendamento.'))
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <div
    class="rounded-xl border border-outline/40 bg-surface-container p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/60"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="font-mono text-sm font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatTimePtBr(item.data_agendada) }}
          </span>
          <span class="text-on-surface-variant dark:text-dark-on-surface-variant">·</span>
          <template v-if="nome">
            <span class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">{{ nome }}</span>
            <span v-if="telefone" class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ telefone }}
            </span>
          </template>
          <span
            v-else-if="telefone"
            class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          >
            {{ telefone }}
          </span>
          <span v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">Sem nome/telefone</span>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          <span class="inline-flex items-center gap-1 font-medium text-on-surface dark:text-dark-on-surface">
            <svg
              v-if="(item.mensagem_type ?? '').trim() === 'imagem'"
              class="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <svg
              v-else-if="(item.mensagem_type ?? '').trim() === 'audio'"
              class="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <svg
              v-else
              class="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h10M4 18h14" />
            </svg>
            {{ tipoLabel }}
          </span>
          <span class="text-on-surface-variant/50 dark:text-dark-on-surface-variant/50">|</span>
          <span>Status: <strong class="text-on-surface dark:text-dark-on-surface">{{ statusLabel }}</strong></span>
          <span class="text-on-surface-variant/50 dark:text-dark-on-surface-variant/50">|</span>
          <span>Recorrente: <strong class="text-on-surface dark:text-dark-on-surface">{{ recorrenteLabel }}</strong></span>
        </div>

        <p
          v-if="mostrarTexto"
          class="whitespace-pre-wrap break-words text-xs leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ item.mensagem_texto }}
        </p>

        <a
          v-if="item.midia_url"
          class="inline-flex break-all text-xs font-medium text-tertiary-accent underline-offset-2 hover:underline dark:text-dark-tertiary"
          :href="item.midia_url"
          target="_blank"
          rel="noreferrer"
        >
          Abrir mídia
        </a>
      </div>

      <div class="flex shrink-0 flex-col gap-1.5">
        <button
          v-if="onEdit"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-outline/50 bg-surface-container-high px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface dark:border-dark-outline/50 dark:bg-dark-surface-container dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-highest dark:hover:text-dark-on-surface"
          @click="onEdit(item)"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Editar
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-container/20 px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-container/40 dark:border-danger/40 dark:bg-danger-container/15 dark:text-danger dark:hover:bg-danger-container/30"
          @click="abrirExcluir"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          Excluir
        </button>
      </div>
    </div>

    <ModalAlerta
      v-model:open="modalExcluir"
      title="Excluir agendamento"
      :texto="textoConfirmarExclusao"
      variante="perigo"
      texto-confirmar="Excluir"
      :confirmar-desabilitado="excluindo"
      @confirmar="confirmarExcluir"
    />
  </div>
</template>
