<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MensagemProntaListaItem } from '#shared/types/mensagensProntas'
import {
  mensagemProntaParaListaItem,
  useMensagensProntasStore,
} from '~/stores/mensagensProntas'
import { toast } from 'vue-sonner'
import { mensagemErroFetch } from '~/stores/canais'

const emit = defineEmits<{
  voltar: []
  criar: []
  editar: [item: MensagemProntaListaItem]
  excluido: []
}>()

const props = defineProps<{
  workspaceId: number
  /** FK da coluna em `funil_workspace_colunas.id_agendamento_mensagem`. */
  idAgendamentoMensagem: string | null
}>()

const store = useMensagensProntasStore()
const pending = ref(false)
const erro = ref<string | null>(null)
const itemVinculado = ref<MensagemProntaListaItem | null>(null)
const excluindo = ref(false)

const temVinculo = computed(() => {
  const id = props.idAgendamentoMensagem
  return typeof id === 'string' && id.trim().length > 0
})

async function carregarVinculada() {
  erro.value = null
  itemVinculado.value = null

  if (!temVinculo.value || !props.workspaceId) return

  pending.value = true
  try {
    const raw = await store.fetchSequenciaPorId(
      props.workspaceId,
      props.idAgendamentoMensagem!,
    )
    itemVinculado.value = raw ? mensagemProntaParaListaItem(raw) : null
    if (!raw) {
      erro.value = 'Agendamento vinculado não encontrado.'
    }
  } catch (err: unknown) {
    erro.value = mensagemErroFetch(err, 'Não foi possível carregar o agendamento.')
    toast.error(erro.value)
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  if (temVinculo.value) void carregarVinculada()
})

watch(
  () => [props.workspaceId, props.idAgendamentoMensagem] as const,
  () => {
    if (temVinculo.value) void carregarVinculada()
    else {
      itemVinculado.value = null
      erro.value = null
      pending.value = false
    }
  },
)

function onEditar(item: MensagemProntaListaItem, ev: Event) {
  ev.stopPropagation()
  ev.preventDefault()
  emit('editar', item)
}

async function onExcluir(item: MensagemProntaListaItem, ev: Event) {
  ev.stopPropagation()
  ev.preventDefault()
  if (!props.workspaceId) {
    toast.error('Workspace não informado.')
    return
  }
  if (!window.confirm(`Excluir o agendamento “${item.titulo}”?`)) return

  excluindo.value = true
  try {
    await store.excluirSequencia(props.workspaceId, item.id)
    itemVinculado.value = null
    emit('excluido')
    toast.success('Agendamento excluído.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir o agendamento.'))
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      type="button"
      class="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
      @click="emit('voltar')"
    >
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
      Voltar
    </button>

    <button
      v-if="!temVinculo || (!pending && !itemVinculado)"
      type="button"
      role="menuitem"
      class="mb-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/10 dark:border-primary/50 dark:bg-primary/10"
      @click="emit('criar')"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
      Criar agendamento
    </button>

    <template v-if="temVinculo">
      <div class="mx-1 border-t border-outline/25 dark:border-dark-outline/25" />
      <p
        class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Agendamento da coluna
      </p>

      <p
        v-if="pending"
        class="px-3 py-4 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Carregando…
      </p>

      <div
        v-else-if="itemVinculado"
        class="group flex items-stretch gap-0.5 rounded-xl transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5">
          <span class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ itemVinculado.titulo }}
          </span>
          <span class="line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ itemVinculado.texto }}
          </span>
        </div>
        <div class="flex shrink-0 flex-col justify-center gap-0.5 pr-1.5">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-primary dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
            aria-label="Editar"
            title="Editar"
            @click="onEditar(itemVinculado, $event)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
          </button>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-dark-on-surface-variant dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            aria-label="Excluir"
            title="Excluir"
            :disabled="excluindo"
            @click="onExcluir(itemVinculado, $event)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>

      <p
        v-else
        class="px-3 py-4 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ erro || 'Agendamento não encontrado.' }}
      </p>
    </template>
  </div>
</template>
