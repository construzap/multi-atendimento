<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import ItemCustoCanal from '~/components/admin/custos_ia/ItemCustoCanal.vue'
import ItemErroCustoIa from '~/components/admin/custos_ia/ItemErroCustoIa.vue'
import SeletorModoCustosIa from '~/components/admin/custos_ia/SeletorModoCustosIa.vue'
import { type AdminCustosIaModo, useAdminCustosIaStore } from '~/stores/adminCustosIa'
import { mensagemErroFetch } from '~/stores/canais'

const store = useAdminCustosIaStore()
const {
  modo,
  items,
  erros,
  pending,
  loaded,
  errosLoaded,
  error: errorMsg,
  totalCustoBrl,
  totalTokens,
  totalPalavras,
  totalLetras,
  totalMensagens,
  custoPorLetraLista,
  custoPorMensagemLista,
} = storeToRefs(store)

const listaPronta = computed(() => (modo.value === 'erros' ? errosLoaded.value : loaded.value))

async function carregar({ force = false } = {}) {
  try {
    await store.fetchModoAtual({ force })
  } catch (err) {
    toast.error(
      mensagemErroFetch(
        err,
        modo.value === 'erros'
          ? 'Não foi possível carregar os erros da I.A.'
          : 'Não foi possível carregar os custos da I.A.',
      ),
    )
  }
}

async function onModoChange(novo: AdminCustosIaModo) {
  try {
    await store.setModo(novo)
  } catch (err) {
    toast.error(
      mensagemErroFetch(
        err,
        novo === 'erros'
          ? 'Não foi possível carregar os erros da I.A.'
          : 'Não foi possível carregar os custos da I.A.',
      ),
    )
  }
}

onMounted(() => {
  carregar().catch(() => {})
})

function formatBrl(value: number, maxFrac = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(value)
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div class="space-y-3">
        <SeletorModoCustosIa :model-value="modo" :disabled="pending" @update:model-value="onModoChange" />
        <div>
          <h2 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
            <template v-if="modo === 'custos'">
              Custos por canal
              <template v-if="listaPronta && !pending">({{ items.length }})</template>
            </template>
            <template v-else>
              Erros da I.A
              <template v-if="listaPronta && !pending">({{ erros.length }})</template>
            </template>
          </h2>
          <p
            v-if="modo === 'custos' && listaPronta && !pending && items.length > 0"
            class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Total {{ formatBrl(totalCustoBrl) }} · {{ formatTokens(totalTokens) }} tokens ·
            {{ formatTokens(totalPalavras) }} palavras · {{ formatTokens(totalLetras) }} letras ·
            {{ formatTokens(totalMensagens) }} mensagens ·
            {{ formatBrl(custoPorLetraLista, 8) }}/letra · {{ formatBrl(custoPorMensagemLista, 6) }}/msg
          </p>
          <p
            v-else-if="modo === 'erros' && listaPronta && !pending"
            class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Registros com erro = true
          </p>
        </div>
      </div>
      <button
        type="button"
        class="rounded-lg border border-outline/40 px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-dark-outline/40 dark:text-dark-on-surface-variant"
        :disabled="pending"
        @click="carregar({ force: true })"
      >
        {{ pending ? 'Carregando...' : 'Atualizar' }}
      </button>
    </div>

    <div
      v-if="pending && !listaPronta"
      class="flex flex-1 items-center justify-center py-16 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ modo === 'erros' ? 'Carregando erros...' : 'Carregando custos...' }}
    </div>

    <div
      v-else-if="errorMsg"
      class="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-6 text-sm text-danger dark:text-dark-danger"
    >
      {{ errorMsg }}
    </div>

    <template v-else-if="modo === 'custos'">
      <div
        v-if="listaPronta && items.length === 0"
        class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
      >
        <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          Nenhum custo encontrado
        </p>
        <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Ainda não há registros em custos de tokens da I.A.
        </p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <ItemCustoCanal
          v-for="(item, idx) in items"
          :key="`${item.workspace_id}-${item.canal_id ?? 'null'}-${idx}`"
          :item="item"
        />
      </div>
    </template>

    <template v-else>
      <div
        v-if="listaPronta && erros.length === 0"
        class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
      >
        <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          Nenhum erro encontrado
        </p>
        <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Não há registros com erro = true em custos de tokens da I.A.
        </p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <ItemErroCustoIa
          v-for="(item, idx) in erros"
          :key="`${item.workspace_id}-${item.canal_id ?? 'null'}-${item.url_erro ?? ''}-${idx}`"
          :item="item"
        />
      </div>
    </template>
  </div>
</template>
