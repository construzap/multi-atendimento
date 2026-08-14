<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Cobranca } from '#shared/types/cobranca'
import ListaCobrancas from '~/components/cobranca/ListaCobrancas.vue'
import Fundo from '~/components/cobranca/criar-cliente/Fundo.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useCobrancaStore } from '~/stores/cobranca'

definePageMeta({
  layout: 'workspace',
})

const cobrancaStore = useCobrancaStore()
/** `criar` | `editar` | null (painel fechado) */
const modoPainel = ref<'criar' | 'editar' | null>(null)
const cobrancaEditandoId = ref<number | null>(null)
const carregandoEdicaoId = ref<number | null>(null)
const painelRef = ref<HTMLElement | null>(null)

const painelAberto = computed(() => modoPainel.value != null)
const criando = computed(() => modoPainel.value === 'criar')
const tituloPainel = computed(() =>
  modoPainel.value === 'editar' ? 'Editar cobrança' : 'Criar cobrança',
)

async function scrollParaPainel() {
  await nextTick()
  painelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function abrirCriar() {
  carregandoEdicaoId.value = null
  modoPainel.value = 'criar'
  cobrancaEditandoId.value = null
  void scrollParaPainel()
}

async function abrirEditar(cobranca: Cobranca) {
  if (
    modoPainel.value === 'editar' &&
    cobrancaEditandoId.value === cobranca.id
  ) {
    fecharPainel()
    return
  }
  if (carregandoEdicaoId.value != null) return

  modoPainel.value = null
  cobrancaEditandoId.value = null
  carregandoEdicaoId.value = cobranca.id
  try {
    await cobrancaStore.ensureProdutosLoaded(cobranca.id, cobranca.workspace_id)
    modoPainel.value = 'editar'
    cobrancaEditandoId.value = cobranca.id
    void scrollParaPainel()
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os produtos da cobrança.'))
  } finally {
    carregandoEdicaoId.value = null
  }
}

function fecharPainel() {
  modoPainel.value = null
  cobrancaEditandoId.value = null
  carregandoEdicaoId.value = null
}
</script>

<template>
  <div class="min-h-full bg-white pb-14 pt-6 transition-colors dark:bg-dark-background md:pt-10">
    <div class="mx-auto max-w-6xl space-y-8 px-4 md:px-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl space-y-2">
          <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface md:text-4xl">
            Cobranças
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
          Criar cliente
        </button>
      </header>

      <ListaCobrancas
        :criando="criando"
        :cobranca-editando-id="cobrancaEditandoId"
        :carregando-edicao-id="carregandoEdicaoId"
        @edit="abrirEditar"
      >
        <template v-if="painelAberto" #formulario>
          <div
            ref="painelRef"
            class="overflow-hidden rounded-2xl border border-outline/30 bg-surface-container-lowest shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container-low"
          >
            <div
              class="flex items-center justify-between gap-3 border-b border-outline/20 px-4 py-3 dark:border-dark-outline/20 sm:px-6"
            >
              <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
                {{ tituloPainel }}
              </h3>
              <button
                type="button"
                class="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
                aria-label="Fechar"
                @click="fecharPainel"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <Fundo
              :key="cobrancaEditandoId ?? 'criar'"
              :cobranca-id="cobrancaEditandoId"
              @close="fecharPainel"
              @created="fecharPainel"
              @updated="fecharPainel"
            />
          </div>
        </template>
      </ListaCobrancas>
    </div>
  </div>
</template>
