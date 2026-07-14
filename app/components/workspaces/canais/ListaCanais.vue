<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import CanalCard from '~/components/workspaces/canais/CanalCard.vue'
import ModalAddCanal from '~/components/workspaces/canais/ModalAddCanal.vue'
import type { Canal } from '#shared/types/canal'

const props = defineProps<{
  workspaceId: number
}>()

const pesquisa = ref('')
const modalAberto = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const canalEdicaoId = ref<number | null>(null)

const canaisStore = useCanaisStore()

watch(
  () => props.workspaceId,
  (id) => {
    if (Number.isFinite(id)) {
      canaisStore.ensureCanaisLoaded(id).catch(() => {})
    }
  },
  { immediate: true }
)

const itensFiltrados = computed(() => {
  const q = pesquisa.value.trim().toLowerCase()
  const list = canaisStore.items
  if (!q) return list
  return list.filter((c) => {
    const nome = (c.nome ?? '').toLowerCase()
    const desc = (c.descricao ?? '').toLowerCase()
    return nome.includes(q) || desc.includes(q) || String(c.id).includes(q)
  })
})

function labelData(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `Criado em ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d)}`
}

function abrirCriar() {
  modalMode.value = 'create'
  canalEdicaoId.value = null
  modalAberto.value = true
}

function abrirEdicao(canal: Canal) {
  modalMode.value = 'edit'
  canalEdicaoId.value = canal.id
  modalAberto.value = true
}

watch(modalAberto, (aberto) => {
  if (!aberto) {
    canalEdicaoId.value = null
    modalMode.value = 'create'
  }
})
</script>

<template>
  <div>
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="min-w-0 flex-1">
          <BaseInput
            id="canais-pesquisa"
            v-model="pesquisa"
            type="search"
            name="pesquisa-canais"
            placeholder="Buscar por nome, descrição ou ID…"
            autocomplete="off"
            wrapper-id="canais-pesquisa-wrap"
          >
            <template #leading>
              <svg
                class="h-5 w-5 text-gray-400 dark:text-dark-on-surface-variant/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" stroke-linecap="round" />
              </svg>
            </template>
          </BaseInput>
        </div>
        <div class="w-full sm:w-auto sm:shrink-0">
          <BaseButton type="button" class="sm:w-auto sm:min-w-[11rem]" @click="abrirCriar">
            Adicionar canal
          </BaseButton>
        </div>
      </div>

      <p
        v-if="canaisStore.listError"
        class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        role="alert"
      >
        {{ canaisStore.listError }}
      </p>

      <template v-if="canaisStore.listPending">
        <p
          class="font-body rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          Carregando canais…
        </p>
      </template>
      <template v-else>
        <p
          v-if="itensFiltrados.length === 0"
          class="font-body rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <template v-if="pesquisa.trim()">
            Nenhum canal encontrado para “{{ pesquisa.trim() }}”.
          </template>
          <template v-else>
            Nenhum canal neste workspace ainda. Use “Adicionar canal” para criar o primeiro.
          </template>
        </p>

        <CanalCard
          v-for="c in itensFiltrados"
          :key="c.id"
          :workspace-id="workspaceId"
          :canal="c"
          :data-criacao-label="labelData(c.created_at)"
          status="ativo"
          @editar="abrirEdicao"
        />
      </template>
    </div>

    <ModalAddCanal
      v-model:open="modalAberto"
      :mode="modalMode"
      :workspace-id="workspaceId"
      :canal-edicao-id="canalEdicaoId"
    />
  </div>
</template>
