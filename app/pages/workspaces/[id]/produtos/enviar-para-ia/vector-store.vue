<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '~/components/produtos/enviar-para-ia/vector-store/AppHeader.vue'
import WorkspaceSelector from '~/components/produtos/enviar-para-ia/vector-store/WorkspaceSelector.vue'
import SyncStatusCard from '~/components/produtos/enviar-para-ia/vector-store/SyncStatusCard.vue'
import SyncActionButton from '~/components/produtos/enviar-para-ia/vector-store/SyncActionButton.vue'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const workspacesStore = useWorkspacesStore()
const { currentWorkspaceId } = storeToRefs(workspacesStore)

const workspaceId = computed(() => {
  const raw = currentWorkspaceId.value ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
})

const syncStatusCardRef = ref<{ refresh: () => void } | null>(null)

function atualizarStatusIndexacao() {
  syncStatusCardRef.value?.refresh()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader title="Vector Store — Produtos" />

    <main class="mx-auto max-w-3xl space-y-4 px-6 py-6">
      <WorkspaceSelector />

      <SyncStatusCard
        v-if="workspaceId != null"
        ref="syncStatusCardRef"
        :workspace-id="workspaceId"
      />

      <SyncActionButton
        v-if="workspaceId != null"
        :workspace-id="workspaceId"
        @completed="atualizarStatusIndexacao"
        @stopped="atualizarStatusIndexacao"
      />
    </main>
  </div>
</template>
