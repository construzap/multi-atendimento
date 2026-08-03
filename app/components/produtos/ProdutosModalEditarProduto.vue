<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ProdutoWorkspaceCampos, ProdutoWorkspacePatch } from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    row?: ProdutoWorkspaceCampos | null
  }>(),
  {
    workspaceId: null,
    row: null,
  },
)

const emit = defineEmits<{
  salvar: [patch: ProdutoWorkspacePatch]
}>()

const nome = ref('')
const termoSelecao = ref<{ id: number; nome: string } | null>(null)
const unidadeVenda = ref('')
const marca = ref('')
const precoCusto = ref('')
const precoVista = ref('')
const precoPrazo = ref('')
const precoPromocional = ref('')
const pesoKg = ref('')
const largura = ref('')
const altura = ref('')
const comprimento = ref('')
const sku = ref('')
const codigoNcm = ref('')
const codigoBarras = ref('')
const infosRelevantes = ref('')
const statusAtivo = ref(true)
const salvando = ref(false)

function fmtPrecoCampo(n: number | null | undefined): string {
  if (n == null || n === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtNumCampo(n: number | null | undefined, vazioSeZero = false): string {
  if (n == null) return ''
  if (vazioSeZero && n === 0) return ''
  return String(n).replace('.', ',')
}

function popularDoRow(row: ProdutoWorkspaceCampos) {
  nome.value = row.nome ?? ''
  const termo = row.termos_pesquisa?.[0]
  if (termo?.id && termo.nome) {
    termoSelecao.value = { id: termo.id, nome: termo.nome }
  } else {
    termoSelecao.value = null
  }
  unidadeVenda.value = row.unidade_venda ?? ''
  marca.value = row.marca ?? ''
  precoCusto.value = fmtPrecoCampo(row.preco_custo)
  precoVista.value = fmtPrecoCampo(row.preco)
  precoPrazo.value = fmtPrecoCampo(row.preco_prazo)
  precoPromocional.value = fmtPrecoCampo(row.preco_promocional)
  pesoKg.value = fmtNumCampo(row.peso_kg)
  largura.value = fmtNumCampo(row.largura, true)
  altura.value = fmtNumCampo(row.altura, true)
  comprimento.value = fmtNumCampo(row.comprimento, true)
  sku.value = row.sku ?? ''
  codigoNcm.value = row.codigo_ncm ?? ''
  codigoBarras.value = row.codigo_barras_ean ?? ''
  infosRelevantes.value = row.infos_relevantes ?? ''
  statusAtivo.value = !!row.status
  salvando.value = false
}

function limpar() {
  nome.value = ''
  termoSelecao.value = null
  unidadeVenda.value = ''
  marca.value = ''
  precoCusto.value = ''
  precoVista.value = ''
  precoPrazo.value = ''
  precoPromocional.value = ''
  pesoKg.value = ''
  largura.value = ''
  altura.value = ''
  comprimento.value = ''
  sku.value = ''
  codigoNcm.value = ''
  codigoBarras.value = ''
  infosRelevantes.value = ''
  statusAtivo.value = true
  salvando.value = false
}

watch(
  () => [open.value, props.row] as const,
  ([isOpen, row]) => {
    if (isOpen && row) {
      popularDoRow(row)
    } else if (!isOpen) {
      limpar()
    }
  },
  { immediate: true },
)

const podeSalvar = computed(() => {
  return nome.value.trim().length > 0 && !salvando.value && props.row != null
})

function strOuNull(v: string): string | null {
  const t = v.trim()
  return t.length ? t : null
}

function parsePrecoObrigatorio(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t.length) return 0
  const n = parseDecimalPtBr(t)
  if (n == null || n < 0) {
    toast.error(`${label} inválido.`)
    return null
  }
  return n
}

function parsePrecoOpcional(raw: string, label: string): number | null | undefined {
  const t = raw.trim()
  if (!t.length) return null
  const n = parseDecimalPtBr(t)
  if (n == null || n < 0) {
    toast.error(`${label} inválido.`)
    return undefined
  }
  return n
}

function parseDimensao(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t.length) return 0
  const n = parseDecimalPtBr(t)
  if (n == null || n < 0) {
    toast.error(`${label} inválido.`)
    return null
  }
  return n
}

function montarPatch(): ProdutoWorkspacePatch | null {
  const n = nome.value.trim()
  if (!n) {
    toast.error('O nome não pode ser vazio.')
    return null
  }

  const preco = parsePrecoObrigatorio(precoVista.value, 'Preço à vista')
  if (preco == null) return null
  const precoCustoN = parsePrecoObrigatorio(precoCusto.value, 'Preço de custo')
  if (precoCustoN == null) return null
  const precoPrazoN = parsePrecoOpcional(precoPrazo.value, 'Preço a prazo')
  if (precoPrazoN === undefined) return null
  const precoPromoN = parsePrecoOpcional(precoPromocional.value, 'Preço promocional')
  if (precoPromoN === undefined) return null

  const pesoRaw = pesoKg.value.trim()
  let pesoN: number | null = null
  if (pesoRaw.length) {
    const p = parseDecimalPtBr(pesoRaw)
    if (p == null || p < 0) {
      toast.error('Peso inválido.')
      return null
    }
    pesoN = p
  }

  const larguraN = parseDimensao(largura.value, 'Largura')
  if (larguraN == null) return null
  const alturaN = parseDimensao(altura.value, 'Altura')
  if (alturaN == null) return null
  const comprimentoN = parseDimensao(comprimento.value, 'Comprimento')
  if (comprimentoN == null) return null

  const patch: ProdutoWorkspacePatch = {
    nome: n,
    unidade_venda: strOuNull(unidadeVenda.value),
    marca: strOuNull(marca.value),
    preco,
    preco_custo: precoCustoN,
    preco_prazo: precoPrazoN,
    preco_promocional: precoPromoN,
    peso_kg: pesoN,
    largura: larguraN,
    altura: alturaN,
    comprimento: comprimentoN,
    sku: strOuNull(sku.value),
    codigo_ncm: strOuNull(codigoNcm.value),
    codigo_barras_ean: strOuNull(codigoBarras.value),
    infos_relevantes: strOuNull(infosRelevantes.value),
    status: statusAtivo.value,
    termos_pesquisa_ids: termoSelecao.value?.id != null ? [termoSelecao.value.id] : [],
  }
  return patch
}

function salvar() {
  if (!props.row) return
  const patch = montarPatch()
  if (!patch) return
  salvando.value = true
  emit('salvar', patch)
  open.value = false
  salvando.value = false
}

function fechar() {
  open.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Editar produto"
    panel-class="w-full max-w-3xl max-h-[90vh]"
  >
    <template #subtitle>
      Altere os campos abaixo e salve. As alterações são aplicadas imediatamente.
    </template>

    <div class="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
      <div class="md:col-span-2">
        <label
          for="produto-edit-nome"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Nome do produto
        </label>
        <BaseInput
          id="produto-edit-nome"
          v-model="nome"
          placeholder="Nome do produto"
          autocomplete="off"
        />
      </div>

      <div class="md:col-span-2">
        <label
          for="produto-edit-termo"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Termo de pesquisa
        </label>
        <ProdutosSelecaoUnica
          catalogo="termos_pesquisa"
          variant="form"
          :workspace-id="workspaceId"
          :ativo="open"
          v-model:selecao="termoSelecao"
          input-id="produto-edit-termo"
          placeholder="Comece a digitar para buscar…"
        />
      </div>

      <div>
        <label
          for="produto-edit-unidade"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Unidade de venda
        </label>
        <BaseInput
          id="produto-edit-unidade"
          v-model="unidadeVenda"
          placeholder="Ex: UN, CX, KG"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-marca"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Marca
        </label>
        <BaseInput
          id="produto-edit-marca"
          v-model="marca"
          placeholder="Marca do produto"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-custo"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Preço de custo (R$)
        </label>
        <BaseInput
          id="produto-edit-custo"
          v-model="precoCusto"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 50,00"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-vista"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Preço à vista (R$)
        </label>
        <BaseInput
          id="produto-edit-vista"
          v-model="precoVista"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 109,23"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-prazo"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Preço a prazo (R$)
        </label>
        <BaseInput
          id="produto-edit-prazo"
          v-model="precoPrazo"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 119,90"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-promo"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Preço promocional (R$)
        </label>
        <BaseInput
          id="produto-edit-promo"
          v-model="precoPromocional"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 99,90"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-peso"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Peso (kg)
        </label>
        <BaseInput
          id="produto-edit-peso"
          v-model="pesoKg"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 1,5"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-largura"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Largura (cm)
        </label>
        <BaseInput
          id="produto-edit-largura"
          v-model="largura"
          type="text"
          inputmode="decimal"
          placeholder="0"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-altura"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Altura (cm)
        </label>
        <BaseInput
          id="produto-edit-altura"
          v-model="altura"
          type="text"
          inputmode="decimal"
          placeholder="0"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-comprimento"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Comprimento (cm)
        </label>
        <BaseInput
          id="produto-edit-comprimento"
          v-model="comprimento"
          type="text"
          inputmode="decimal"
          placeholder="0"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-sku"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          SKU
        </label>
        <BaseInput
          id="produto-edit-sku"
          v-model="sku"
          placeholder="Código / SKU"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          for="produto-edit-ncm"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          NCM
        </label>
        <BaseInput
          id="produto-edit-ncm"
          v-model="codigoNcm"
          placeholder="NCM"
          autocomplete="off"
        />
      </div>

      <div class="md:col-span-2 md:max-w-[calc(50%-0.625rem)]">
        <label
          for="produto-edit-ean"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Código de barras (EAN)
        </label>
        <BaseInput
          id="produto-edit-ean"
          v-model="codigoBarras"
          placeholder="EAN"
          autocomplete="off"
        />
      </div>

      <div class="md:col-span-2">
        <label
          for="produto-edit-infos"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Informações relevantes
        </label>
        <BaseTextarea
          id="produto-edit-infos"
          v-model="infosRelevantes"
          placeholder="Detalhes importantes do produto"
          :min-height-px="80"
          :max-height-px="220"
          :submit-on-enter="false"
        />
      </div>

      <div class="md:col-span-2">
        <span class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Status
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            :class="
              statusAtivo
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high dark:border-dark-outline/50 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high'
            "
            @click="statusAtivo = true"
          >
            Ativo
          </button>
          <button
            type="button"
            class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            :class="
              !statusAtivo
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high dark:border-dark-outline/50 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high'
            "
            @click="statusAtivo = false"
          >
            Inativo
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton type="button" variant="secondary" :block="false" :disabled="salvando" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" variant="primary" :block="false" :disabled="!podeSalvar" @click="salvar">
        {{ salvando ? 'Salvando…' : 'Salvar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
