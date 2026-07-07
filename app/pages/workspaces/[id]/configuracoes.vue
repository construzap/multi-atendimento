<script setup lang="ts">
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import WorkspaceConfiguracoesForm from '~/components/configuracoes/WorkspaceConfiguracoesForm.vue'
import WorkspaceConfiguracoesIa from '~/components/configuracoes/WorkspaceConfiguracoesIa.vue'
import WorkspaceConfiguracoesNotificacoes from '~/components/configuracoes/WorkspaceConfiguracoesNotificacoes.vue'
import WorkspaceConfiguracoesTempos from '~/components/configuracoes/WorkspaceConfiguracoesTempos.vue'
import { useConfiguracoesStore } from '~/stores/configuracoes'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const workspaces = useWorkspacesStore()
const configuracoes = useConfiguracoesStore()

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const carregando = computed(() => {
  const id = workspaceId.value
  return id != null && configuracoes.carregando(id)
})

watch(
  workspaceId,
  async (id) => {
    configuracoes.limparErro()
    if (!id) return
    if (configuracoes.porWorkspace[id] !== undefined) return

    const ok = await configuracoes.fetchSeNecessario(id)
    if (!ok && configuracoes.fetchError) {
      toast.error(configuracoes.fetchError)
    }
  },
  { immediate: true },
)

async function onSalvarTudo() {
  if (workspaceId.value == null) {
    toast.error('Workspace não encontrado.')
    return
  }

  try {
    await configuracoes.salvar()
    toast.success('Configurações salvas com sucesso.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao salvar configurações.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Configurações
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Gerencie as configurações do seu workspace
      </p>
    </header>

    <WorkspaceConfiguracoesForm />

    <WorkspaceConfiguracoesNotificacoes />

    <WorkspaceConfiguracoesIa />

    <WorkspaceConfiguracoesTempos />

    <div v-if="workspaceId" class="pt-2">
      <BaseButton
        id="btn-ws-config-salvar-tudo"
        type="button"
        :disabled="carregando || configuracoes.salvando"
        @click="onSalvarTudo"
      >
        {{ configuracoes.salvando ? 'Salvando...' : carregando ? 'Carregando...' : 'Salvar alterações' }}
      </BaseButton>
    </div>
  </div>
</template>
