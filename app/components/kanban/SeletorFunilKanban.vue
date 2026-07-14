<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { KanbanCriarFunilResponse } from '#shared/types/kanban'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import ModalCriarFunilKanban from '~/components/kanban/ModalCriarFunilKanban.vue'
import { useKanbanStore } from '~/stores/kanban'

const props = defineProps<{
  workspaceId: number
}>()

const route = useRoute()
const router = useRouter()
const kanban = useKanbanStore()
const { funis, funisPending, funilNome } = storeToRefs(kanban)

const modalCriarAberto = ref(false)

const funilAtivoId = computed(() => {
  const raw = route.params.funilId
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  return kanban.funilId
})

const nomeExibicao = computed(() => {
  const ativoId = funilAtivoId.value
  if (ativoId != null) {
    const ativo = funis.value.find((f) => f.id === ativoId)
    if (ativo?.nome?.trim()) return ativo.nome.trim()
  }
  const fallback = funilNome.value?.trim()
  return fallback || 'Kanban'
})

function carregarFunisSeNecessario() {
  if (!props.workspaceId) return
  void kanban.ensureFunisLoaded(props.workspaceId).catch(() => {})
}

onMounted(() => {
  carregarFunisSeNecessario()
})

watch(
  () => props.workspaceId,
  (id, prev) => {
    if (!id || id === prev) return
    void kanban.ensureFunisLoaded(id).catch(() => {})
  },
)

function onDropdownOpenChange(aberto: boolean) {
  if (!aberto) return
  carregarFunisSeNecessario()
}

function selecionarFunil(id: number, close: () => void) {
  close()
  if (!props.workspaceId || id === funilAtivoId.value) return
  void router.push(`/workspaces/${props.workspaceId}/kanban/${id}`)
}

function abrirModalCriarFunil(close: () => void) {
  close()
  modalCriarAberto.value = true
}

function onFunilCriado(res: KanbanCriarFunilResponse) {
  kanban.adicionarFunilCriado(res)
  if (!props.workspaceId) return
  void router.push(`/workspaces/${props.workspaceId}/kanban/${res.id}`)
}
</script>

<template>
  <BaseDropdown
    title="Funis"
    align="left"
    side="bottom"
    panel-class="w-72 min-w-[16rem] max-w-[calc(100vw-2rem)]"
    @open-change="onDropdownOpenChange"
  >
    <template #trigger>
      <span
        class="group/trigger inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl px-1 py-0.5 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
      >
        <h1
          class="min-w-0 truncate font-headline text-2xl font-bold text-slate-900 dark:text-dark-on-surface"
        >
          {{ nomeExibicao }}
        </h1>
        <span
          class="material-symbols-outlined shrink-0 text-[22px] text-slate-500 transition-transform group-hover/trigger:text-primary-600 dark:text-slate-400 dark:group-hover/trigger:text-primary-400"
          aria-hidden="true"
        >
          expand_more
        </span>
      </span>
    </template>

    <template #default="{ close }">
      <p
        v-if="funisPending && funis.length === 0"
        class="px-3 py-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Carregando funis…
      </p>

      <p
        v-else-if="!funisPending && funis.length === 0"
        class="px-3 py-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum funil cadastrado.
      </p>

      <button
        v-for="funil in funis"
        :key="funil.id"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
        :class="
          funil.id === funilAtivoId
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
            : 'text-on-surface hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
        "
        @click="selecionarFunil(funil.id, close)"
      >
        <span
          class="material-symbols-outlined text-[18px]"
          :class="funil.id === funilAtivoId ? 'text-primary-600 dark:text-primary-400' : 'text-on-surface-variant dark:text-dark-on-surface-variant'"
          aria-hidden="true"
        >
          {{ funil.id === funilAtivoId ? 'check_circle' : 'account_tree' }}
        </span>
        <span class="min-w-0 flex-1 truncate">{{ funil.nome }}</span>
      </button>

      <div class="mx-1 my-1.5 border-t border-outline/30 dark:border-dark-outline/30" />

      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40"
        @click="abrirModalCriarFunil(close)"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
        Criar novo funil
      </button>
    </template>
  </BaseDropdown>

  <ModalCriarFunilKanban
    v-model:open="modalCriarAberto"
    @criado="onFunilCriado"
  />
</template>
