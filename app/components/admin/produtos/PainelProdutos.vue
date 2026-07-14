<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import { mensagemErroFetch } from '~/stores/canais'

const adminStore = useAdminStore()
const { selectedWorkspaceId, workspaceSelecionado, limiteProdutosAtual, limiteProdutosSalvando } =
  storeToRefs(adminStore)

const limiteDraft = ref<number | null>(null)

watch(
  limiteProdutosAtual,
  (valor) => {
    limiteDraft.value = valor
  },
  { immediate: true },
)

watch(selectedWorkspaceId, () => {
  limiteDraft.value = limiteProdutosAtual.value
})

const limiteAlterado = computed(() => {
  const draft = limiteDraft.value
  const atual = limiteProdutosAtual.value
  if (draft == null && atual == null) return false
  return Number(draft) !== Number(atual)
})

async function salvarLimite() {
  if (!selectedWorkspaceId.value || limiteProdutosSalvando.value) return

  const raw = limiteDraft.value
  const valor =
    raw === null || raw === undefined || String(raw).trim() === ''
      ? null
      : Number.parseInt(String(raw), 10)

  if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
    toast.error('Informe um limite válido (inteiro ≥ 0) ou deixe vazio.')
    return
  }

  try {
    await adminStore.atualizarLimiteProdutos(valor)
    toast.success('Limite de produtos atualizado.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o limite de produtos.'))
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div
      v-if="!selectedWorkspaceId"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:text-dark-primary"
        aria-hidden="true"
      >
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 7h12l-1.5 11H7.5L6 7z" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Selecione um workspace
      </p>
      <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha um workspace na barra lateral para ver e editar o limite de produtos.
      </p>
    </div>

    <section
      v-else
      class="rounded-2xl border border-outline/40 bg-surface-container-lowest p-5 shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div class="mb-4">
        <h2 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
          Limite de produtos
        </h2>
        <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspace:
          <span class="font-semibold text-on-surface dark:text-dark-on-surface">
            {{ workspaceSelecionado?.nome || '—' }}
          </span>
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="min-w-0 flex-1">
          <span
            class="mb-1.5 block font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            limite_produtos
          </span>
          <input
            v-model.number="limiteDraft"
            type="number"
            min="0"
            step="1"
            placeholder="Sem limite (null)"
            :disabled="limiteProdutosSalvando"
            class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
          />
        </label>

        <BaseButton
          id="btn-salvar-limite-produtos"
          variant="primary"
          size="sm"
          :block="false"
          :disabled="limiteProdutosSalvando || !limiteAlterado"
          @click="salvarLimite"
        >
          {{ limiteProdutosSalvando ? 'Salvando...' : 'Salvar limite' }}
        </BaseButton>
      </div>

      <p class="mt-3 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        Valor atual:
        <span class="font-semibold text-on-surface dark:text-dark-on-surface">
          {{ limiteProdutosAtual ?? 'null (sem limite)' }}
        </span>
      </p>
    </section>
  </div>
</template>
