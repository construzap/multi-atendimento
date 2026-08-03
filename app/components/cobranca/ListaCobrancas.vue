<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { Cobranca } from '#shared/types/cobranca'
import { useCanaisStore } from '~/stores/canais'
import { useCobrancaStore } from '~/stores/cobranca'
import { useWorkspacesStore } from '~/stores/workspaces'
import ItemCobranca from '~/components/cobranca/ItemCobranca.vue'

const props = withDefaults(
  defineProps<{
    /** Painel de criação aberto (abaixo da lista). */
    criando?: boolean
    /** ID da cobrança cujo formulário está expandido abaixo do card. */
    cobrancaEditandoId?: number | null
    /** ID da cobrança em carregamento (mostra “Carregando...”). */
    carregandoEdicaoId?: number | null
  }>(),
  {
    criando: false,
    cobrancaEditandoId: null,
    carregandoEdicaoId: null,
  },
)

const emit = defineEmits<{
  edit: [cobranca: Cobranca]
}>()

const workspaces = useWorkspacesStore()
const cobrancaStore = useCobrancaStore()
const canaisStore = useCanaisStore()
const { items, pending, error } = storeToRefs(cobrancaStore)

const workspaceId = computed<number | null>(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

async function carregar() {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await Promise.all([
      cobrancaStore.ensureCobrancasLoaded(wid),
      canaisStore.ensureCanaisLoaded(wid),
    ])
  } catch {
    // erro já fica no store
  }
}

watch(workspaceId, () => {
  void carregar()
})

onMounted(() => {
  void carregar()
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h2 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
          Clientes
        </h2>
      </div>
      <p
        v-if="!pending && !error"
        class="shrink-0 font-label text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ items.length }} {{ items.length === 1 ? 'item' : 'itens' }}
      </p>
    </div>

    <p v-if="pending" class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando cobranças...
    </p>
    <p v-else-if="error" class="font-body text-sm text-danger dark:text-dark-danger">
      {{ error }}
    </p>
    <div
      v-else-if="items.length === 0 && !criando"
      class="rounded-2xl border border-dashed border-outline/40 px-6 py-12 text-center dark:border-dark-outline/40"
    >
      <p class="font-label text-base font-semibold text-on-surface dark:text-dark-on-surface">
        Nenhuma cobrança ainda
      </p>
      <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Clique em “Criar cliente” para começar.
      </p>
    </div>
    <ul v-else-if="items.length > 0" class="space-y-3">
      <li
        v-for="cobranca in items"
        :key="cobranca.id"
        class="space-y-3"
      >
        <ItemCobranca
          :cobranca="cobranca"
          :selecionado="cobrancaEditandoId === cobranca.id || carregandoEdicaoId === cobranca.id"
          @edit="emit('edit', $event)"
        />
        <div
          v-if="carregandoEdicaoId === cobranca.id"
          class="rounded-2xl border border-outline/30 bg-surface-container-lowest px-4 py-6 text-center dark:border-dark-outline/30 dark:bg-dark-surface-container-low"
        >
          <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Carregando...
          </p>
        </div>
        <div
          v-else-if="cobrancaEditandoId === cobranca.id"
          class="pl-0 sm:pl-2"
        >
          <slot name="formulario" />
        </div>
      </li>
    </ul>

    <div
      v-if="criando"
      class="space-y-3"
    >
      <slot name="formulario" />
    </div>
  </section>
</template>
