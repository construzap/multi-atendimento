<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import BaseModal from '~/components/BaseModal.vue'
import MapeamentoDescricaoComTooltip from '~/components/MapeamentoDescricaoComTooltip.vue'
import {
  mapeamentoTemCamposObrigatorios,
  type CampoMapeamentoColuna,
} from '~/utils/mapeamentoColunasImportacao'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    nomeArquivo?: string | null
    arquivo?: File | null
    colunasSuaTabela?: string[]
    exemplosColunas?: string[]
    totalLinhasDados?: number
    campos: CampoMapeamentoColuna[]
    /** Campos que só podem ser mapeados por uma coluna do arquivo. */
    camposUnicos?: string[]
    /** Pelo menos uma coluna deve mapear para cada id listado. */
    camposObrigatorios?: string[]
    /** Rótulo da coluna de destino no cabeçalho da grelha. */
    labelColunaDestino?: string
    /** Campos personalizados (abaixo dos campos do sistema, na mesma lista do dropdown). */
    camposPersonalizados?: CampoMapeamentoColuna[]
    /** Campos do funil/kanban (`status_funil` na importação de contatos). */
    camposFunil?: CampoMapeamentoColuna[]
    /** Exibe botão «Criar campo personalizado» no fim do dropdown. */
    mostrarBotaoCriarCampo?: boolean
    /** Ícone de lápis e lixeira em cada campo personalizado do dropdown. */
    mostrarAcoesCamposPersonalizados?: boolean
  }>(),
  {
    nomeArquivo: null,
    arquivo: null,
    colunasSuaTabela: () => [],
    exemplosColunas: () => [],
    totalLinhasDados: 0,
    camposUnicos: () => [],
    camposObrigatorios: () => [],
    labelColunaDestino: 'Tabela do sistema',
    camposPersonalizados: () => [],
    camposFunil: () => [],
    mostrarBotaoCriarCampo: false,
    mostrarAcoesCamposPersonalizados: false,
  },
)

const emit = defineEmits<{
  confirmarImportacao: [
    payload: {
      mapeamentoPorIndice: Record<number, string>
      totalLinhasDados: number
    },
  ]
  'confirmar-importacao': [
    payload: {
      mapeamentoPorIndice: Record<number, string>
      totalLinhasDados: number
    },
  ]
  criarCampo: []
  editarCampoPersonalizado: [campoId: string]
  excluirCampoPersonalizado: [campoId: string]
}>()

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

function labelCampoMapeado(campoId: string): string | null {
  const todos = [...props.campos, ...props.camposPersonalizados, ...props.camposFunil]
  return todos.find((c) => c.id === campoId)?.label ?? null
}

function textoCampoMapeado(indice: number): string {
  const id = mapeamentoPorIndice.value[indice]
  if (!id) return '— Não mapear —'
  return labelCampoMapeado(id) ?? id
}

function campoMapeado(indice: number): boolean {
  return Boolean(mapeamentoPorIndice.value[indice])
}

function campoEstaMapeado(campoId: string): boolean {
  return Object.values(mapeamentoPorIndice.value).some((v) => v === campoId)
}

function indiceOndeCampoEstaMapeado(campoId: string): number | null {
  for (const [k, v] of Object.entries(mapeamentoPorIndice.value)) {
    if (v !== campoId) continue
    const i = Number(k)
    if (Number.isFinite(i)) return i
  }
  return null
}

function tituloColunaArquivo(indice: number): string {
  return linhasMapeamento.value.find((l) => l.indice === indice)?.titulo ?? `Coluna ${indice + 1}`
}

function setMapeamento(indice: number, campoId: string, close: () => void) {
  const next = { ...mapeamentoPorIndice.value }
  if (!campoId) {
    delete next[indice]
  } else {
    for (const k of Object.keys(next)) {
      const i = Number(k)
      if (Number.isFinite(i) && i !== indice && next[i] === campoId) {
        delete next[i]
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

const podeImportar = computed(() =>
  mapeamentoTemCamposObrigatorios(mapeamentoPorIndice.value, props.camposObrigatorios),
)

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
      <slot name="subtitle" :total-linhas-dados="totalLinhasDados" />
      <span
        v-if="nomeArquivo"
        class="mt-1 block text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ nomeArquivo }}
        <span v-if="arquivo"> · {{ formatarTamanho(arquivo.size) }}</span>
      </span>
    </template>

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
        <span class="leading-tight">{{ labelColunaDestino }}</span>
      </div>
    </div>
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
        {{ labelColunaDestino }}
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
                  v-for="campo in campos"
                  :key="campo.id"
                  type="button"
                  role="menuitem"
                  class="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  :class="
                    mapeamentoPorIndice[linha.indice] === campo.id
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                      : campoEstaMapeado(campo.id)
                        ? 'bg-emerald-50/60 text-on-surface dark:bg-emerald-950/20 dark:text-dark-on-surface'
                        : 'text-on-surface hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
                  "
                  @click="setMapeamento(linha.indice, campo.id, close)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full"
                      :class="
                        campoEstaMapeado(campo.id)
                          ? 'bg-emerald-500'
                          : 'bg-outline/40 dark:bg-dark-outline/50'
                      "
                      aria-hidden="true"
                    />
                    <span class="min-w-0 truncate">{{ campo.label }}</span>
                    <span
                      v-if="mapeamentoPorIndice[linha.indice] === campo.id"
                      class="material-symbols-outlined ml-auto shrink-0 text-[16px] text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    >
                      check
                    </span>
                  </span>
                  <span
                    v-if="
                      campoEstaMapeado(campo.id) &&
                      mapeamentoPorIndice[linha.indice] !== campo.id &&
                      indiceOndeCampoEstaMapeado(campo.id) != null
                    "
                    class="pl-4 text-[11px] leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Em: {{ tituloColunaArquivo(indiceOndeCampoEstaMapeado(campo.id)!) }}
                  </span>
                </button>

                <template v-if="camposFunil.length">
                  <div
                    class="my-1.5 border-t border-outline/25 dark:border-dark-outline/25"
                    role="separator"
                    aria-hidden="true"
                  />
                  <p
                    class="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Funil / Kanban
                  </p>
                  <button
                    v-for="campo in camposFunil"
                    :key="campo.id"
                    type="button"
                    role="menuitem"
                    class="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors"
                    :class="
                      mapeamentoPorIndice[linha.indice] === campo.id
                        ? 'bg-sky-50 text-sky-900 dark:bg-sky-950/35 dark:text-sky-100'
                        : campoEstaMapeado(campo.id)
                          ? 'bg-sky-50/60 text-on-surface dark:bg-sky-950/20 dark:text-dark-on-surface'
                          : 'hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high'
                    "
                    @click="setMapeamento(linha.indice, campo.id, close)"
                  >
                    <span class="flex min-w-0 items-center gap-2 text-sm font-medium text-on-surface dark:text-dark-on-surface">
                      <span
                        class="h-2 w-2 shrink-0 rounded-full"
                        :class="
                          campoEstaMapeado(campo.id)
                            ? 'bg-sky-500'
                            : 'bg-outline/40 dark:bg-dark-outline/50'
                        "
                        aria-hidden="true"
                      />
                      <span class="min-w-0 truncate">{{ campo.label }}</span>
                      <span
                        v-if="mapeamentoPorIndice[linha.indice] === campo.id"
                        class="material-symbols-outlined ml-auto shrink-0 text-[16px] text-sky-600 dark:text-sky-400"
                        aria-hidden="true"
                      >
                        check
                      </span>
                    </span>
                    <MapeamentoDescricaoComTooltip
                      v-if="campo.descricao"
                      :descricao="campo.descricao"
                      :descricao-completa="campo.descricaoCompleta"
                    />
                    <span
                      v-if="
                        campoEstaMapeado(campo.id) &&
                        mapeamentoPorIndice[linha.indice] !== campo.id &&
                        indiceOndeCampoEstaMapeado(campo.id) != null
                      "
                      class="pl-4 text-[11px] leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
                    >
                      Em: {{ tituloColunaArquivo(indiceOndeCampoEstaMapeado(campo.id)!) }}
                    </span>
                  </button>
                </template>

                <template v-if="camposPersonalizados.length">
                  <div
                    class="my-1.5 border-t border-outline/25 dark:border-dark-outline/25"
                    role="separator"
                    aria-hidden="true"
                  />
                  <p
                    class="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Campos personalizados
                  </p>
                  <div
                    v-for="campo in camposPersonalizados"
                    :key="campo.id"
                    class="flex items-center gap-0.5 rounded-xl px-1 py-0.5 transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm font-medium"
                      :class="
                        mapeamentoPorIndice[linha.indice] === campo.id
                          ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/35 dark:text-violet-100'
                          : campoEstaMapeado(campo.id)
                            ? 'bg-violet-50/60 text-on-surface dark:bg-violet-950/20 dark:text-dark-on-surface'
                            : 'text-on-surface dark:text-dark-on-surface'
                      "
                      @click="setMapeamento(linha.indice, campo.id, close)"
                    >
                      <span class="flex min-w-0 items-center gap-2">
                        <span
                          class="h-2 w-2 shrink-0 rounded-full"
                          :class="
                            campoEstaMapeado(campo.id)
                              ? 'bg-violet-500'
                              : 'bg-outline/40 dark:bg-dark-outline/50'
                          "
                          aria-hidden="true"
                        />
                        <span class="min-w-0 truncate">{{ campo.label }}</span>
                        <span
                          v-if="mapeamentoPorIndice[linha.indice] === campo.id"
                          class="material-symbols-outlined ml-auto shrink-0 text-[16px] text-violet-600 dark:text-violet-400"
                          aria-hidden="true"
                        >
                          check
                        </span>
                      </span>
                      <span
                        v-if="
                          campoEstaMapeado(campo.id) &&
                          mapeamentoPorIndice[linha.indice] !== campo.id &&
                          indiceOndeCampoEstaMapeado(campo.id) != null
                        "
                        class="pl-4 text-[11px] leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
                      >
                        Em: {{ tituloColunaArquivo(indiceOndeCampoEstaMapeado(campo.id)!) }}
                      </span>
                    </button>
                    <template v-if="mostrarAcoesCamposPersonalizados">
                      <button
                        type="button"
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-primary dark:text-slate-400 dark:hover:bg-dark-surface-container-low dark:hover:text-primary"
                        aria-label="Editar campo personalizado"
                        @click.stop="emit('editarCampoPersonalizado', campo.id)"
                      >
                        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                      </button>
                      <button
                        type="button"
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label="Excluir campo personalizado"
                        @click.stop="emit('excluirCampoPersonalizado', campo.id)"
                      >
                        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                      </button>
                    </template>
                  </div>
                </template>

                <template v-if="mostrarBotaoCriarCampo">
                  <div
                    class="my-1.5 border-t border-outline/25 dark:border-dark-outline/25"
                    role="separator"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                    @click="emit('criarCampo'); close()"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add_circle</span>
                    <span class="min-w-0 truncate">Criar campo personalizado</span>
                  </button>
                </template>
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
