<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import BaseModal from '~/components/BaseModal.vue'
import { CAMPOS_TABELA_IA_PRODUTO } from '~/constants/produtosCamposIa'
import { mapeamentoTemNome } from '~/utils/mapearLinhasImportacaoProduto'

defineOptions({ name: 'MAPEAMENTODECOLUNAS' })

/** Categoria por nome (pesquisa/criar no catálogo): `~/components/produtos/ProdutosItemCategoria.vue`. */

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    nomeArquivo?: string | null
    arquivo?: File | null
    colunasSuaTabela?: string[]
    exemplosColunas?: string[]
    totalLinhasDados?: number
  }>(),
  {
    nomeArquivo: null,
    arquivo: null,
    colunasSuaTabela: () => [],
    exemplosColunas: () => [],
    totalLinhasDados: 0,
  },
)

const emit = defineEmits<{
  /** Preferir este nome no `emit` (alinha com o tipo do Volar). */
  confirmarImportacao: [
    payload: {
      mapeamentoPorIndice: Record<number, string>
      totalLinhasDados: number
    },
  ]
  /** Equivalente em kebab-case (templates podem usar `@confirmar-importacao`). */
  'confirmar-importacao': [
    payload: {
      mapeamentoPorIndice: Record<number, string>
      totalLinhasDados: number
    },
  ]
}>()

/** Índice da coluna do ficheiro → id do campo na tabela IA (vazio = não mapear). */
const mapeamentoPorIndice = ref<Record<number, string>>({})

watch(
  () => props.colunasSuaTabela.join('\x1f'),
  () => {
    mapeamentoPorIndice.value = {}
  },
)

const linhasMapeamento = computed(() =>
  props.colunasSuaTabela.map((tituloBruto, indice) => {
    const titulo = tituloBruto.trim().length ? tituloBruto.trim() : `Coluna ${indice + 1} (vazia)`
    const exemplo = props.exemplosColunas[indice] ?? ''
    return { indice, titulo, exemplo }
  }),
)

function textoExemplo(ex: string, max = 56): string {
  const t = (ex ?? '').trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function textoCampoMapeado(indice: number): string {
  const id = mapeamentoPorIndice.value[indice]
  if (!id) return '— Não mapear —'
  return CAMPOS_TABELA_IA_PRODUTO.find((c) => c.id === id)?.label ?? id
}

function campoMapeado(indice: number): boolean {
  return Boolean(mapeamentoPorIndice.value[indice])
}

function setMapeamento(indice: number, campoId: string, close: () => void) {
  const next = { ...mapeamentoPorIndice.value }
  if (!campoId) {
    delete next[indice]
  } else {
    if (campoId === 'categoria') {
      for (const k of Object.keys(next)) {
        const i = Number(k)
        if (Number.isFinite(i) && i !== indice && next[i] === 'categoria') {
          delete next[i]
        }
      }
    }
    next[indice] = campoId
  }
  mapeamentoPorIndice.value = next
  close()
}

function fechar() {
  open.value = false
}

const podeImportar = computed(() => mapeamentoTemNome(mapeamentoPorIndice.value))

function aoClicarImportar() {
  if (!podeImportar.value) return
  emit('confirmarImportacao', {
    mapeamentoPorIndice: { ...mapeamentoPorIndice.value },
    totalLinhasDados: props.totalLinhasDados,
  })
}

function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Mapeamento de colunas"
    panel-class="w-full max-w-3xl"
  >
    <template #subtitle>
      <span class="block leading-relaxed">
        Conecte as colunas do seu arquivo aos campos da nossa tabela. Cada produto admite
        <strong class="text-on-surface dark:text-dark-on-surface">uma única categoria</strong>
        — só pode haver uma coluna mapeada para «Categoria».
        <template v-if="totalLinhasDados > 0">
          Detectamos <strong class="text-on-surface dark:text-dark-on-surface">{{ totalLinhasDados }}</strong> registros.
        </template>
      </span>
      <span
        v-if="nomeArquivo"
        class="mt-1 block text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ nomeArquivo }}
        <span v-if="arquivo"> · {{ formatarTamanho(arquivo.size) }}</span>
      </span>
    </template>

    <!-- Mesma grelha que cada linha: legenda da esquerda alinhada à coluna importada; "Tabela da I.A" à coluna do dropdown -->
    <div
      v-if="linhasMapeamento.length"
      class="mb-2 hidden gap-3 px-4 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant sm:grid sm:grid-cols-[1fr_min(100%,18rem)] sm:gap-x-6 dark:text-dark-on-surface-variant"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        <span class="leading-tight">Tabela que você está importando</span>
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
        <span class="leading-tight">Tabela da I.A</span>
      </div>
    </div>
    <!-- Em ecrãs pequenos mostrar legenda empilhada -->
    <div
      v-if="linhasMapeamento.length"
      class="mb-3 flex flex-col gap-2 px-4 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
    >
      <span class="inline-flex items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        Tabela que você está importando
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
        Tabela da I.A
      </span>
    </div>

    <div v-if="linhasMapeamento.length" class="max-h-[min(28rem,60vh)] space-y-3 overflow-y-auto pr-1">
      <div
        v-for="linha in linhasMapeamento"
        :key="linha.indice"
        class="rounded-2xl border border-outline/25 bg-surface-container-low/90 px-4 py-4 shadow-sm dark:border-dark-outline/25 dark:bg-dark-surface-container-low/90"
      >
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_min(100%,18rem)] sm:items-center sm:gap-x-6"
        >
          <div class="min-w-0">
            <p class="break-words font-bold text-on-surface dark:text-dark-on-surface">
              {{ linha.titulo }}
            </p>
            <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
              Ex: {{ textoExemplo(linha.exemplo) }}
            </p>
          </div>
          <div class="w-full min-w-0 sm:max-w-none">
            <BaseDropdown
              teleport
              title="Campo no sistema"
              align="right"
              panel-class="w-72 min-w-[12rem] max-w-[min(22rem,calc(100vw-3rem))]"
            >
              <template #trigger>
                <span
                  class="inline-flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors"
                  :class="
                    campoMapeado(linha.indice)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/35 dark:text-emerald-100'
                      : 'border-outline/30 bg-white text-on-surface shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface'
                  "
                >
                  <span class="min-w-0 truncate">{{ textoCampoMapeado(linha.indice) }}</span>
                  <span class="material-symbols-outlined shrink-0 text-[22px] opacity-70" aria-hidden="true">
                    expand_more
                  </span>
                </span>
              </template>
              <template #default="{ close }">
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="setMapeamento(linha.indice, '', close)"
                >
                  — Não mapear —
                </button>
                <button
                  v-for="campo in CAMPOS_TABELA_IA_PRODUTO"
                  :key="campo.id"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="setMapeamento(linha.indice, campo.id, close)"
                >
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    :class="
                      mapeamentoPorIndice[linha.indice] === campo.id
                        ? 'bg-emerald-500'
                        : 'bg-outline/40 dark:bg-dark-outline/50'
                    "
                    aria-hidden="true"
                  />
                  <span class="min-w-0 truncate">{{ campo.label }}</span>
                </button>
              </template>
            </BaseDropdown>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Nenhum cabeçalho encontrado na primeira linha do arquivo.
    </p>

    <template #footer>
      <BaseButton type="button" variant="secondary" :block="false" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" variant="primary" :block="false" :disabled="!podeImportar" @click="aoClicarImportar">
        <span class="inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">upload</span>
          <template v-if="totalLinhasDados > 0">Importar {{ totalLinhasDados }} registros</template>
          <template v-else>Importar</template>
        </span>
      </BaseButton>
    </template>
  </BaseModal>
</template>
