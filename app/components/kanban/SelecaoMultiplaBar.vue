<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseModal from '~/components/BaseModal.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'

const props = withDefaults(
  defineProps<{
    count: number
    workspaceId: number
    funilId: number
    selectedKeys: string[]
    /** Exibe a barra fixa inferior (seleção múltipla). */
    showBar?: boolean
    /** Pré-seleciona coluna ao abrir o modal (ex.: status atual da conversa). */
    colunaInicialId?: number | null
  }>(),
  {
    showBar: true,
    colunaInicialId: null,
  },
)

const emit = defineEmits<{
  limpar: []
  concluido: []
}>()

const kanban = useKanbanStore()
const conversasStore = useConversasStore()
const { funis, funisPending, funisError } = storeToRefs(kanban)

const modalAberto = defineModel<boolean>('modalOpen', { default: false })
const colunaSelecionadaId = ref<number | null>(null)

const progressoAberto = ref(false)
const progressoTotal = ref(0)
const progressoEnviados = ref(0)
const progressoErro = ref<string | null>(null)
const emAndamento = ref(false)
const cancelarSolicitado = ref(false)

const funisComColunas = computed(() => funis.value.filter((funil) => funil.columns.length > 0))

const subtituloModal = computed(() =>
  props.selectedKeys.length === 1
    ? 'Escolha a coluna de destino para este contato.'
    : 'Escolha a coluna de destino para os contatos selecionados.',
)

function funilIdDaColuna(colunaId: number): number | null {
  for (const funil of funis.value) {
    if (funil.columns.some((c) => c.id === colunaId)) return funil.id
  }
  return null
}

function espelharColunaNoPinia(conversaKey: string, colunaId: number) {
  const conv = conversasStore.findConversaByKey(conversaKey)
  if (!conv) return
  const funilId = funilIdDaColuna(colunaId)
  conversasStore.addOrUpdateLocalConversa(
    { ...conv, coluna_id: colunaId, funil_id: funilId },
    conv.id_canal ?? undefined,
  )
  useKanbanStore().espelharConversaAtualizadaNoBoard(props.workspaceId, {
    ...conv,
    coluna_id: colunaId,
    funil_id: funilId,
  })
}

const podeConfirmarAlteracao = computed(
  () => colunaSelecionadaId.value != null && !funisPending.value && funisComColunas.value.length > 0,
)

function abrirModalAlterarStatus() {
  modalAberto.value = true
}

defineExpose({ abrirModalAlterarStatus })

function fecharModal() {
  if (emAndamento.value) return
  modalAberto.value = false
}

function isColunaSelecionada(colunaId: number) {
  return colunaSelecionadaId.value === colunaId
}

function selecionarColuna(colunaId: number) {
  colunaSelecionadaId.value = colunaId
}

function classeColunaItem(selecionada: boolean) {
  return [
    'flex cursor-pointer items-center rounded-xl border px-3 py-2.5 transition-colors',
    selecionada
      ? 'border-primary-500/50 bg-primary-500/10 dark:border-primary-400/40 dark:bg-primary-400/10'
      : 'border-outline/25 bg-surface-container-lowest/60 hover:border-outline/40 hover:bg-surface-container-high/50 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50 dark:hover:border-dark-outline/35 dark:hover:bg-dark-surface-container-high/40',
  ]
}

async function confirmarAlterarStatus() {
  const colunaId = colunaSelecionadaId.value
  if (colunaId == null || props.selectedKeys.length === 0) return

  const keys = props.selectedKeys.map((k) => k.trim()).filter(Boolean)
  if (keys.length === 0) return

  modalAberto.value = false
  await nextTick()

  progressoTotal.value = keys.length
  progressoEnviados.value = 0
  progressoErro.value = null
  cancelarSolicitado.value = false
  emAndamento.value = true
  progressoAberto.value = true

  let falhas = 0

  for (const conversaKey of keys) {
    if (cancelarSolicitado.value) break

    try {
      await $fetch('/api/kanban/mover', {
        method: 'POST',
        body: {
          workspace_id: props.workspaceId,
          conversa_key: conversaKey,
          coluna_id: colunaId,
        },
      })
      espelharColunaNoPinia(conversaKey, colunaId)
    } catch (err: unknown) {
      falhas += 1
      if (!progressoErro.value) {
        progressoErro.value = mensagemErroFetch(err, 'Não foi possível alterar o status de uma ou mais conversas.')
      }
    } finally {
      progressoEnviados.value += 1
    }
  }

  emAndamento.value = false

  if (props.workspaceId > 0 && props.funilId > 0) {
    await kanban.fetchBoard(props.workspaceId, props.funilId).catch(() => {})
  }

  if (cancelarSolicitado.value) {
    toast.info('Alteração de status cancelada.')
    emit('concluido')
    return
  }

  if (falhas === 0) {
    progressoAberto.value = false
    toast.success(
      keys.length === 1
        ? 'Status alterado com sucesso.'
        : `Status alterado em ${keys.length} conversas.`,
    )
    emit('concluido')
    return
  }

  if (falhas < keys.length) {
    progressoErro.value = `${falhas} de ${keys.length} conversa(s) não puderam ser alteradas.`
  }

  emit('concluido')
}

function aoCancelarProgresso() {
  if (emAndamento.value) {
    cancelarSolicitado.value = true
    return
  }
  progressoAberto.value = false
  progressoErro.value = null
}

watch(modalAberto, (aberto) => {
  if (!aberto) {
    colunaSelecionadaId.value = null
    return
  }
  const inicial = props.colunaInicialId
  if (inicial != null && inicial > 0) {
    colunaSelecionadaId.value = inicial
  }
  if (props.workspaceId > 0) {
    void kanban.ensureFunisLoaded(props.workspaceId).catch(() => {})
  }
})
</script>

<template>
  <div
    v-if="props.showBar"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-outline/30 bg-white/95 backdrop-blur dark:border-dark-outline/30 dark:bg-slate-950/90"
  >
    <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ props.count }} selecionado{{ props.count === 1 ? '' : 's' }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('limpar')"
        >
          Limpar
        </button>
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          :disabled="props.count < 1"
          @click="abrirModalAlterarStatus"
        >
          Alterar status
        </button>
      </div>
    </div>
  </div>

  <BaseModal
    :open="modalAberto"
    title="Alterar status"
    panel-class="w-full max-w-lg max-h-[min(92vh,40rem)]"
    @update:open="modalAberto = $event"
    @close="fecharModal"
  >
    <template #subtitle>
      {{ subtituloModal }}
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[22px]">view_kanban</span>
    </template>

    <p v-if="funisPending" class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando funis e colunas…
    </p>

    <p v-else-if="funisError" class="text-sm text-danger">
      {{ funisError }}
    </p>

    <p
      v-else-if="funisComColunas.length === 0"
      class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhuma coluna encontrada nos funis deste workspace.
    </p>

    <div v-else class="max-h-[min(24rem,55vh)] space-y-4 overflow-y-auto pr-0.5">
      <section v-for="funil in funisComColunas" :key="funil.id" class="space-y-2">
        <p class="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
          {{ funil.nome?.trim() || `Funil #${funil.id}` }}
        </p>
        <ul class="space-y-2" role="list">
          <li v-for="coluna in funil.columns" :key="coluna.id">
            <label :class="classeColunaItem(isColunaSelecionada(coluna.id))">
              <span class="flex min-w-0 items-center gap-3">
                <input
                  type="radio"
                  :name="`coluna-alterar-status-${props.workspaceId}-${props.selectedKeys.join('-') || 'solo'}`"
                  class="h-4 w-4 border-outline/50 text-primary-600 transition-shadow focus:ring-2 focus:ring-primary-500/30 dark:border-dark-outline/50 dark:focus:ring-dark-primary/30"
                  :checked="isColunaSelecionada(coluna.id)"
                  @change="selecionarColuna(coluna.id)"
                />
                <span
                  v-if="coluna.cor"
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: coluna.cor }"
                  aria-hidden="true"
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

    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-outline/40 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
        @click="fecharModal"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
        :disabled="!podeConfirmarAlteracao"
        @click="confirmarAlterarStatus"
      >
        Confirmar
      </button>
    </template>
  </BaseModal>

  <ModalEnvioProdutos
    v-model:open="progressoAberto"
    title="Alterando status…"
    :total="progressoTotal"
    :enviados="progressoEnviados"
    :erro="progressoErro"
    :pode-cancelar="emAndamento || !!progressoErro"
    @cancelar="aoCancelarProgresso"
  >
    <template #extra>
      <p
        v-if="emAndamento"
        class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Atualizando coluna e funil das conversas selecionadas…
      </p>
      <p
        v-else-if="progressoErro"
        class="text-sm font-medium text-on-surface dark:text-dark-on-surface"
      >
        Processo finalizado com erros. Feche para continuar.
      </p>
      <p
        v-else
        class="text-sm font-medium text-emerald-700 dark:text-emerald-300"
      >
        Alteração concluída.
      </p>
    </template>
  </ModalEnvioProdutos>
</template>
