<script setup lang="ts">
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import FreteItemLinha from '~/components/frete/FreteItemLinha.vue'
import { useFreteStore } from '~/stores/frete'

const route = useRoute()
const workspaces = useWorkspacesStore()
const freteStore = useFreteStore()

const workspaceId = computed(() => {
  const fromPinia = workspaces.currentWorkspaceId
  const raw = fromPinia ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
})

const itens = computed(() => {
  const wid = workspaceId.value
  if (wid == null) return []
  return freteStore.bairrosPorWorkspace[wid] ?? []
})

const carregando = computed(() => {
  const wid = workspaceId.value
  if (wid == null) return false
  return freteStore.bairrosCarregando(wid)
})

watch(
  workspaceId,
  async (wid) => {
    freteStore.limparErroBairros()
    if (wid == null) return
    const ok = await freteStore.fetchBairrosRecentes(wid, false)
    if (!ok && freteStore.bairrosFetchError) {
      toast.error(freteStore.bairrosFetchError)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-surface-container-lowest px-4 shadow-lg dark:bg-dark-surface-container-low"
  >
    <div class="px-5 py-6 sm:px-8">
      <h2
        class="text-center font-headline text-lg font-bold leading-[1.15] tracking-tight text-on-surface dark:text-dark-on-surface sm:text-left md:text-xl"
      >
        <span class="block">Fretes</span>
        <span class="block">adicionados</span>
      </h2>
    </div>

    <div class="bg-surface-container-low/30 dark:bg-dark-surface-container-lowest/80">
      <template v-if="workspaceId == null">
        <div class="px-8 py-10 text-center font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspace não identificado.
        </div>
      </template>
      <template v-else-if="carregando && itens.length === 0">
        <div class="px-8 py-10 text-center font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Carregando fretes…
        </div>
      </template>
      <template v-else-if="!carregando && itens.length === 0">
        <div class="px-8 py-10 text-center font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Nenhum frete por bairro cadastrado ainda.
        </div>
      </template>
      <template v-else>
        <template v-for="row in itens" :key="row.id">
          <FreteItemLinha
            v-if="workspaceId != null"
            :id="row.id"
            :workspace-id="workspaceId"
            :bairro="row.bairro"
            :valor-frete="row.valor_frete"
            :frete-gratis="row.frete_gratis"
          />
        </template>
      </template>
    </div>
  </div>
</template>
