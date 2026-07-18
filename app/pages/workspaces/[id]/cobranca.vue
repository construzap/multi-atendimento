<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Cobranca } from '#shared/types/cobranca'
import BaseModal from '~/components/BaseModal.vue'
import ListaCobrancas from '~/components/cobranca/ListaCobrancas.vue'
import Fundo from '~/components/cobranca/criar-cobranca/Fundo.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useCobrancaStore } from '~/stores/cobranca'

definePageMeta({
  layout: 'workspace',
})

const cobrancaStore = useCobrancaStore()
const modalAberto = ref(false)
const cobrancaEditandoId = ref<number | null>(null)
const carregandoEdicao = ref(false)

const tituloModal = computed(() =>
  cobrancaEditandoId.value ? 'Editar cobrança' : 'Criar cobrança',
)

function abrirCriar() {
  cobrancaEditandoId.value = null
  modalAberto.value = true
}

async function abrirEditar(cobranca: Cobranca) {
  if (carregandoEdicao.value) return
  carregandoEdicao.value = true
  try {
    await cobrancaStore.ensureProdutosLoaded(cobranca.id, cobranca.workspace_id)
    cobrancaEditandoId.value = cobranca.id
    modalAberto.value = true
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os produtos da cobrança.'))
  } finally {
    carregandoEdicao.value = false
  }
}

function fecharModal() {
  modalAberto.value = false
  cobrancaEditandoId.value = null
}
</script>

<template>
  <div class="min-h-full bg-background pb-14 pt-6 transition-colors dark:bg-dark-background md:pt-10">
    <div class="mx-auto max-w-6xl space-y-8 px-4 md:px-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl space-y-2">
          <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface md:text-4xl">
            Cobrança de Fiados
          </h1>
          <p class="font-body text-base leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
            Crie e gerencie cobranças de fiados para seus clientes.
          </p>
        </div>

        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 font-label text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
          @click="abrirCriar"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Criar cobrança
        </button>
      </header>

      <ListaCobrancas @edit="abrirEditar" />
    </div>

    <BaseModal
      v-model:open="modalAberto"
      :title="tituloModal"
      panel-class="w-full max-w-5xl max-h-[92vh]"
      body-class="!p-0"
      @close="fecharModal"
    >
      <Fundo
        :cobranca-id="cobrancaEditandoId"
        @close="fecharModal"
      />
    </BaseModal>
  </div>
</template>
