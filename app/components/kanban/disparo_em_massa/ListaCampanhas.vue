<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import ItemCampanha from '~/components/kanban/disparo_em_massa/ItemCampanha.vue'
import { useDisparoEmMassaStore } from '~/stores/disparoEmMassa'

const props = defineProps<{
  workspaceId: number
}>()

const emit = defineEmits<{
  editar: [campanhaId: string]
  excluido: [campanhaId: string]
}>()

const disparoEmMassa = useDisparoEmMassaStore()
const { campanhas, pending, error } = storeToRefs(disparoEmMassa)

async function carregarCampanhas() {
  if (!props.workspaceId) return
  await disparoEmMassa.fetchCampanhas(props.workspaceId)
}

watch(
  () => props.workspaceId,
  (id) => {
    if (!import.meta.client || !id) return
    void carregarCampanhas()
  },
  { immediate: true },
)
</script>

<template>
  <section class="space-y-4" aria-labelledby="lista-campanhas-titulo">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="lista-campanhas-titulo" class="text-sm font-bold text-on-surface dark:text-dark-on-surface">
        Campanhas
      </h2>
      <p v-if="campanhas.length > 0" class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ campanhas.length }} campanha(s)
      </p>
    </div>

    <p v-if="pending" class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando campanhas…
    </p>

    <p v-else-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <p
      v-else-if="campanhas.length === 0"
      class="rounded-xl border border-dashed border-outline/40 px-4 py-6 text-center text-sm text-on-surface-variant dark:border-dark-outline/40 dark:text-dark-on-surface-variant"
    >
      Nenhuma campanha encontrada neste workspace.
    </p>

    <ul v-else class="space-y-3" role="list">
      <li v-for="campanha in campanhas" :key="campanha.id">
        <ItemCampanha
          :campanha="campanha"
          :workspace-id="workspaceId"
          @editar="emit('editar', $event)"
          @excluido="emit('excluido', $event)"
        />
      </li>
    </ul>
  </section>
</template>
