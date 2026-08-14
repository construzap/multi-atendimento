<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '~/components/BaseButton.vue'
import CriarCampanhaConfig from '~/components/kanban/disparo_em_massa/CriarCampanhaConfig.vue'
import ListaCampanhas from '~/components/kanban/disparo_em_massa/ListaCampanhas.vue'
import type { CriarCampanhaResponse, AtualizarCampanhaResponse } from '#shared/types/disparoEmMassa'
import { useDisparoEmMassaStore } from '~/stores/disparoEmMassa'
import { useKanbanStore } from '~/stores/kanban'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const kanban = useKanbanStore()
const disparoEmMassa = useDisparoEmMassaStore()
const { columns, pending, error } = storeToRefs(kanban)
const { campanhaEdicaoId } = storeToRefs(disparoEmMassa)

const configAberto = ref(false)

const workspaceId = computed(() => {
  const raw = route.params.id
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
})

watch(
  workspaceId,
  (id) => {
    if (!import.meta.client || !id) return
    void kanban.ensureBoardLoaded(id)
  },
  { immediate: true },
)

function abrirNovaCampanha() {
  disparoEmMassa.setCampanhaEdicao(null)
  configAberto.value = true
}

function abrirEdicaoCampanha(campanhaId: string) {
  disparoEmMassa.setCampanhaEdicao(campanhaId)
  configAberto.value = true
}

function fecharConfigCampanha() {
  configAberto.value = false
  disparoEmMassa.setCampanhaEdicao(null)
}

function onCampanhaCriada(_response: CriarCampanhaResponse) {
  fecharConfigERecarregar()
}

function onCampanhaAtualizada(_response: AtualizarCampanhaResponse) {
  fecharConfigERecarregar()
}

function fecharConfigERecarregar() {
  configAberto.value = false
  disparoEmMassa.setCampanhaEdicao(null)
  disparoEmMassa.invalidarCampanhas()
  if (workspaceId.value) {
    void disparoEmMassa.fetchCampanhas(workspaceId.value, { force: true })
  }
}

function onCampanhaExcluida(campanhaId: string) {
  if (campanhaEdicaoId.value === campanhaId && configAberto.value) {
    configAberto.value = false
  }
}
</script>

<template>
  <div class="relative min-h-[100dvh] w-full p-4 md:p-6">
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    />

    <div class="mx-auto max-w-3xl space-y-6">
      <header class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
          Kanban · Envio em massa
        </p>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Disparo em massa
        </h1>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Crie campanhas para enviar mensagens em lote às conversas selecionadas por coluna do funil.
        </p>
      </header>

      <div
        class="rounded-2xl border border-outline/30 bg-surface-container-lowest/80 p-6 shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container-low/80"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Nova campanha</p>
            <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Configure mensagem, agendamento, canal e destinatários do funil.
            </p>
            <p
              v-if="!pending && columns.length > 0"
              class="text-[11px] font-medium text-primary-700 dark:text-primary-300"
            >
              {{ columns.length }} coluna(s) disponível(is) no funil.
            </p>
            <p v-else-if="pending" class="text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              Carregando colunas do funil…
            </p>
            <p v-else-if="error" class="text-[11px] text-danger">
              {{ error }}
            </p>
          </div>

          <BaseButton
            variant="primary"
            :block="false"
            class="!shadow-[0_4px_16px_rgba(37,99,235,0.35)]"
            :disabled="configAberto && !campanhaEdicaoId"
            @click="abrirNovaCampanha"
          >
            <span class="inline-flex items-center gap-2 font-bold">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">rocket_launch</span>
              Criar campanha
            </span>
          </BaseButton>
        </div>
      </div>

      <CriarCampanhaConfig
        v-if="configAberto"
        :key="campanhaEdicaoId ?? 'nova'"
        :campanha-id="campanhaEdicaoId"
        @criado="onCampanhaCriada"
        @atualizado="onCampanhaAtualizada"
        @cancelar="fecharConfigCampanha"
      />

      <ListaCampanhas
        v-if="workspaceId"
        :workspace-id="workspaceId"
        @editar="abrirEdicaoCampanha"
        @excluido="onCampanhaExcluida"
      />
    </div>
  </div>
</template>
