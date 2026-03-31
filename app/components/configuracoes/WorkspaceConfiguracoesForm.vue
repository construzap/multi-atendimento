<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'

const route = useRoute()
const workspaces = useWorkspacesStore()

const workspaceId = computed(() => workspaces.currentWorkspaceId ?? String(route.params.id ?? ''))

const workspace = computed(() => {
  const idNum = Number(workspaceId.value)
  if (!Number.isFinite(idNum)) return null
  return workspaces.items.find((w) => w.id === idNum) ?? null
})

const nome = ref('')
const descricao = ref('')

watchEffect(() => {
  nome.value = workspace.value?.nome ?? ''
  descricao.value = workspace.value?.descricao ?? ''
})

const createdAtLabel = computed(() => {
  const raw = workspace.value?.created_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
})
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Workspace
          </h3>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Visualize as informações do seu workspace
          </p>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div class="w-full sm:w-40">
            <BaseButton type="button" variant="secondary" disabled>Editar</BaseButton>
          </div>
          <div class="w-full sm:w-40">
            <BaseButton type="button" disabled>Deletar</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6">
      <div
        v-if="!workspace"
        class="rounded-xl border border-outline/40 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        Workspace não encontrado no estado atual.
      </div>

      <form v-else class="space-y-5">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-nome">
            Nome
          </label>
          <BaseInput id="ws-config-nome" v-model="nome" type="text" name="nome" autocomplete="off">
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 6h16M4 12h10M4 18h16" stroke-linecap="round" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-descricao">
            Descrição
          </label>
          <BaseInput
            id="ws-config-descricao"
            v-model="descricao"
            type="text"
            name="descricao"
            placeholder="—"
            autocomplete="off"
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M7 7h10M7 12h10M7 17h6" stroke-linecap="round" />
                <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke-linejoin="round" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-created-at">
            Data de criação
          </label>
          <BaseInput
            id="ws-config-created-at"
            :model-value="createdAtLabel"
            type="text"
            name="created_at"
            readonly
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </BaseInput>
        </div>
      </form>
    </div>
  </section>
</template>

