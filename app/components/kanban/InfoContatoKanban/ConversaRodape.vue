<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import AreaChatRodape, { type AreaChatRodapeContexto } from '../../chat/area-chat/AreaChatRodape.vue'
import { useKanbanStore } from '../../../stores/kanban'
import { useWorkspacesStore } from '../../../stores/workspaces'

const kanban = useKanbanStore()
const workspacesStore = useWorkspacesStore()

const { infoContatoConversaKey, infoContatoCard, infoContatoIdCanal, workspaceIdLoaded } =
  storeToRefs(kanban)

const contextoExterno = computed((): AreaChatRodapeContexto | null => {
  const key = infoContatoConversaKey.value
  const card = infoContatoCard.value
  const idCanal = infoContatoIdCanal.value
  if (!key || !card || !idCanal) return null

  const workspaceId =
    workspaceIdLoaded.value ??
    (workspacesStore.currentWorkspaceId != null
      ? Number.parseInt(String(workspacesStore.currentWorkspaceId), 10)
      : null)
  if (workspaceId == null || !Number.isFinite(workspaceId) || workspaceId < 1) return null

  const telefone = card.phone?.trim() || null
  const lid = card.lid?.trim() || null
  if (!telefone && !lid) return null

  return {
    conversaKey: key,
    idCanal,
    workspaceId,
    telefone,
    lid,
    name: card.name,
    photo: card.photo,
  }
})

const podeEnviar = computed(() => contextoExterno.value != null)
</script>

<template>
  <AreaChatRodape
    v-if="podeEnviar && contextoExterno"
    :contexto-externo="contextoExterno"
    compact
    input-id="kanban-mensagem-input"
  />
  <footer
    v-else
    class="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest p-3 dark:bg-slate-900"
  >
    <p class="text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
      <template v-if="!infoContatoConversaKey">
        Selecione um contato para enviar mensagens.
      </template>
      <template v-else-if="!infoContatoIdCanal">
        Conversa sem canal vinculado.
      </template>
      <template v-else>
        Esta conversa não tem telefone nem LID para envio.
      </template>
    </p>
  </footer>
</template>
