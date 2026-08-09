<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import { useKanbanStore } from '~/stores/kanban'
import { useKanbanPusherAlertaStore } from '~/stores/kanbanPusherAlerta'
import { useWorkspacesStore } from '~/stores/workspaces'

const alerta = useKanbanPusherAlertaStore()
const kanban = useKanbanStore()
const workspaces = useWorkspacesStore()
const { open, title, texto, textoConfirmar, textoCancelar, mostrarCancelar, acao } =
  storeToRefs(alerta)

const isPedido = computed(() => acao.value === 'abrir_pedido')

function onCancelar() {
  alerta.close()
}

function onConfirmar() {
  if (alerta.acao === 'abrir_pedido' && alerta.conversaKey) {
    const key = alerta.conversaKey
    const wsId = workspaces.currentWorkspaceId
    if (wsId) {
      void navigateTo(`/workspaces/${wsId}/kanban`)
    }
    kanban.requestOpenNotificacoesIa(key)
  }
  alerta.close()
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :show-close="true"
    :panel-class="isPedido
      ? 'w-full max-w-md overflow-hidden ring-4 ring-primary-500/50 dark:ring-primary-400/40'
      : 'w-full max-w-md'"
    :close-on-backdrop="!isPedido"
    @update:open="(v) => { if (!v) alerta.close() }"
    @close="onCancelar"
  >
    <template #icon>
      <div
        class="relative flex h-12 w-12 items-center justify-center rounded-2xl"
        :class="isPedido
          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/40 dark:bg-primary-500'
          : 'bg-info-container text-info-on-container'"
        aria-hidden="true"
      >
        <span
          v-if="isPedido"
          class="pointer-events-none absolute inset-0 animate-ping rounded-2xl bg-primary-500/40"
        />
        <span class="material-symbols-outlined relative text-[28px] leading-none">
          {{ isPedido ? 'notifications_active' : 'info' }}
        </span>
      </div>
    </template>

    <div
      v-if="isPedido"
      class="-mx-1 mb-4 rounded-xl border-2 border-primary-500/40 bg-primary-500/10 px-4 py-3 dark:border-primary-400/30 dark:bg-primary-400/10"
    >
      <p class="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">
        Atenção — novo pedido
      </p>
    </div>

    <p
      class="font-body leading-relaxed"
      :class="isPedido
        ? 'text-base font-semibold text-on-surface dark:text-dark-on-surface'
        : 'text-sm text-on-surface-variant dark:text-dark-on-surface-variant'"
    >
      {{ texto }}
    </p>

    <template #footer>
      <div v-if="mostrarCancelar" class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" @click="onCancelar">
          {{ textoCancelar }}
        </BaseButton>
      </div>
      <div class="w-full sm:w-52">
        <BaseButton
          type="button"
          :class="isPedido ? '!bg-primary-600 !text-white hover:!bg-primary-700 dark:!bg-primary-500 dark:hover:!bg-primary-600 shadow-md shadow-primary-600/30' : ''"
          @mousedown.prevent="onConfirmar"
        >
          {{ textoConfirmar }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
