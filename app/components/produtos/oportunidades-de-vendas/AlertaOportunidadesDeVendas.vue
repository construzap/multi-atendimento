<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '~/components/BaseButton.vue'
import ModalSugestoesProdutosOportunidadeVendas from '~/components/produtos/oportunidades-de-vendas/ModalSugestoesProdutosOportunidadeVendas.vue'
import type { ProdutoOportunidadeVendaItem } from '#shared/types/produtos'
import { useProdutosStore } from '~/stores/produtos'

const props = defineProps<{
  workspaceId: number | null
}>()

const emit = defineEmits<{
  /** Emitido ao fechar o modal se houve cadastro(s) — pai refresca lista/total e workspace. */
  sincronizar: []
}>()

const produtosStore = useProdutosStore()
const {
  oportunidadesVendasTotal,
  oportunidadesVendasTotalPending,
  oportunidadesVendasMaisRecente,
} = storeToRefs(produtosStore)

const modalAberto = ref(false)
const modalOcupado = ref(false)

const mostrarAlerta = computed(
  () =>
    props.workspaceId != null &&
    props.workspaceId >= 1 &&
    (oportunidadesVendasTotalPending.value ||
      oportunidadesVendasTotal.value > 0 ||
      modalAberto.value ||
      modalOcupado.value),
)

const textoBanner = computed(() => {
  const item = oportunidadesVendasMaisRecente.value
  if (!item) return null

  const cliente = nomeClienteMaisRecente(item)
  const produto = (item.produto_chave || item.produto_sugerido || 'produto').trim()
  const y = item.total_buscas ?? 0
  const quando = formatQuandoUltimaBusca(item.ultima_busca)

  return `Cliente ${cliente} pediu ${y}x por ${produto} ${quando}`
})

function formatQuandoUltimaBusca(iso: string | null | undefined): string {
  if (!iso) return 'em data desconhecida'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'em data desconhecida'

  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const inicioOntem = new Date(inicioHoje)
  inicioOntem.setDate(inicioOntem.getDate() - 1)
  const inicioDia = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

  if (inicioDia.getTime() === inicioHoje.getTime()) return `hoje às ${hora}`
  if (inicioDia.getTime() === inicioOntem.getTime()) return `ontem às ${hora}`

  const data = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  return `em ${data} às ${hora}`
}

function nomeClienteMaisRecente(item: ProdutoOportunidadeVendaItem): string {
  const occ = item.ocorrencias ?? []
  for (const o of occ) {
    const nome = o.contato_nome?.trim()
    if (nome) return nome
  }
  for (const o of occ) {
    const phone = o.phone?.trim()
    if (phone) return phone
  }
  return 'Cliente'
}
const podeAbrirSugestoes = computed(
  () => !oportunidadesVendasTotalPending.value && oportunidadesVendasTotal.value > 0,
)

watch(
  () => props.workspaceId,
  (wid) => {
    if (wid == null || wid < 1) {
      produtosStore.resetOportunidadesVendas()
      modalAberto.value = false
      return
    }
    void produtosStore.fetchOportunidadesVendasTotal(wid)
  },
  { immediate: true },
)

function abrirSugestoes() {
  if (!podeAbrirSugestoes.value) return
  modalAberto.value = true
}

function onBannerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  abrirSugestoes()
}
</script>

<template>
  <div v-if="mostrarAlerta" class="space-y-0">
    <div
      v-if="oportunidadesVendasTotalPending || oportunidadesVendasTotal > 0"
      role="button"
      tabindex="0"
      class="oportunidade-vendas-alerta relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-warning/40 bg-warning-container/25 px-4 py-3.5 shadow-sm transition-[box-shadow,background-color] dark:border-dark-warning/35 dark:bg-dark-warning/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      :class="
        podeAbrirSugestoes
          ? 'cursor-pointer hover:bg-warning-container/40 dark:hover:bg-dark-warning/15'
          : 'cursor-default opacity-90'
      "
      :aria-disabled="!podeAbrirSugestoes"
      aria-label="Ver produtos pedidos sem cadastro"
      @click="abrirSugestoes"
      @keydown="onBannerKeydown"
    >
      <span
        class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-warning dark:bg-dark-warning"
        aria-hidden="true"
      />

      <div class="min-w-0 flex items-start gap-3 pl-1.5">
        <span
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-container text-warning-on-container dark:bg-dark-warning/25 dark:text-dark-warning"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[22px]">warning</span>
        </span>
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Pedidos sem produto no catálogo
            </p>
            <span
              v-if="oportunidadesVendasTotal > 0"
              class="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warning dark:bg-dark-warning/20 dark:text-dark-warning"
            >
              {{ oportunidadesVendasTotal }}
              {{ oportunidadesVendasTotal === 1 ? 'pendente' : 'pendentes' }}
            </span>
          </div>
          <p class="text-sm leading-snug text-on-surface-variant dark:text-dark-on-surface-variant">
            <template v-if="oportunidadesVendasTotalPending && oportunidadesVendasTotal === 0">
              A carregar pedidos…
            </template>
            <template v-else-if="textoBanner">
              {{ textoBanner }}
            </template>
            <template v-else>
              Clientes pediram no WhatsApp produtos que ainda não estão cadastrados.
            </template>
          </p>
        </div>
      </div>

      <BaseButton
        type="button"
        variant="primary"
        size="sm"
        :block="false"
        class="shrink-0 sm:mr-0.5"
        :disabled="!podeAbrirSugestoes"
        @click.stop="abrirSugestoes"
      >
        <span class="inline-flex items-center gap-1.5">
          Resolver agora
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
        </span>
      </BaseButton>
    </div>

    <ModalSugestoesProdutosOportunidadeVendas
      v-model:open="modalAberto"
      v-model:ocupado="modalOcupado"
      :workspace-id="workspaceId"
      @sincronizar="emit('sincronizar')"
    />
  </div>
</template>

<style scoped>
.oportunidade-vendas-alerta {
  animation: oportunidade-vendas-alerta 2.4s ease-in-out infinite;
}

@keyframes oportunidade-vendas-alerta {
  0%,
  100% {
    box-shadow:
      0 0 0 0 color-mix(in srgb, var(--color-warning, #f59e0b) 28%, transparent),
      0 1px 2px 0 rgb(0 0 0 / 0.04);
  }
  50% {
    box-shadow:
      0 0 0 6px transparent,
      0 1px 2px 0 rgb(0 0 0 / 0.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .oportunidade-vendas-alerta {
    animation: none;
  }
}
</style>
