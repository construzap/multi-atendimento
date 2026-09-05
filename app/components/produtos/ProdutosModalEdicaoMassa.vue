<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ProdutoTermoPesquisaItem, ProdutoWorkspacePatch } from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import ProdutosSelecaoMultipla from '~/components/produtos/selecao-multipla/ProdutosSelecaoMultipla.vue'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    quantidade?: number
  }>(),
  {
    workspaceId: null,
    quantidade: 0,
  },
)

const emit = defineEmits<{
  aplicar: [patch: ProdutoWorkspacePatch]
}>()

type CampoMassa =
  | 'status'
  | 'envia_foto'
  | 'marca'
  | 'unidade_venda'
  | 'termos_pesquisa'
  | 'preco'
  | 'preco_custo'
  | 'preco_prazo'
  | 'preco_promocional'
  | 'peso_kg'
  | 'infos_relevantes'

const CAMPOS: { id: CampoMassa; label: string }[] = [
  { id: 'termos_pesquisa', label: 'Categoria / Termo de pesquisa (adicionar)' },
  { id: 'unidade_venda', label: 'Unidade de venda' },
  { id: 'marca', label: 'Marca' },
  { id: 'preco', label: 'Preço à vista (R$)' },
  { id: 'preco_custo', label: 'Preço de custo (R$)' },
  { id: 'preco_prazo', label: 'Preço a prazo (R$)' },
  { id: 'preco_promocional', label: 'Preço promocional (R$)' },
  { id: 'peso_kg', label: 'Peso (kg)' },
  { id: 'infos_relevantes', label: 'Informações relevantes' },
  { id: 'status', label: 'Status' },
  { id: 'envia_foto', label: 'Enviar foto na conversa' },
]

const campoSelecionado = ref<CampoMassa | ''>('')
const statusAtivo = ref(true)
const enviaFoto = ref(true)
const marca = ref('')
const unidadeVenda = ref('')
const termosSelecionados = ref<ProdutoTermoPesquisaItem[]>([])
const precoVista = ref('')
const precoCusto = ref('')
const precoPrazo = ref('')
const precoPromocional = ref('')
const pesoKg = ref('')
const infosRelevantes = ref('')

const subtitulo = computed(() => {
  const n = props.quantidade ?? 0
  if (n === 1) return '1 produto selecionado — escolha o campo e o novo valor.'
  return `${n} produtos selecionados — escolha o campo e o novo valor.`
})

function limparValores() {
  campoSelecionado.value = ''
  statusAtivo.value = true
  enviaFoto.value = true
  marca.value = ''
  unidadeVenda.value = ''
  termosSelecionados.value = []
  precoVista.value = ''
  precoCusto.value = ''
  precoPrazo.value = ''
  precoPromocional.value = ''
  pesoKg.value = ''
  infosRelevantes.value = ''
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) limparValores()
  },
)

function strOuNull(v: string): string | null {
  const t = v.trim()
  return t.length ? t : null
}

function onTermosCommit(patch: ProdutoWorkspacePatch) {
  const ids = patch.termos_pesquisa_ids ?? []
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    termosSelecionados.value = []
    return
  }
  const lista = useProdutoTermosPesquisaStore().getListaCompletaCopia(wid)
  termosSelecionados.value = ids
    .map((id) => lista.find((t) => t.id === id))
    .filter((t): t is ProdutoTermoPesquisaItem => t != null)
}

function parsePrecoObrigatorio(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t.length) {
    toast.error(`Informe o ${label.toLowerCase()}.`)
    return null
  }
  const n = parseDecimalPtBr(t)
  if (n == null || n < 0) {
    toast.error(`${label} inválido.`)
    return null
  }
  return n
}

function montarPatch(): ProdutoWorkspacePatch | null {
  const campo = campoSelecionado.value
  if (!campo) {
    toast.error('Selecione o campo a alterar.')
    return null
  }

  switch (campo) {
    case 'status':
      return { status: statusAtivo.value }
    case 'envia_foto':
      return { envia_foto: enviaFoto.value }
    case 'marca':
      return { marca: strOuNull(marca.value) }
    case 'unidade_venda': {
      const u = unidadeVenda.value.trim()
      if (!u) {
        toast.error('Informe a unidade de venda.')
        return null
      }
      return { unidade_venda: u }
    }
    case 'termos_pesquisa':
      if (!termosSelecionados.value.length) {
        toast.error('Selecione ao menos uma categoria / termo de pesquisa.')
        return null
      }
      return { termos_pesquisa_ids: termosSelecionados.value.map((t) => t.id) }
    case 'preco': {
      const n = parsePrecoObrigatorio(precoVista.value, 'Preço à vista')
      return n == null ? null : { preco: n }
    }
    case 'preco_custo': {
      const n = parsePrecoObrigatorio(precoCusto.value, 'Preço de custo')
      return n == null ? null : { preco_custo: n }
    }
    case 'preco_prazo': {
      const t = precoPrazo.value.trim()
      if (!t.length) return { preco_prazo: null }
      const n = parseDecimalPtBr(t)
      if (n == null || n < 0) {
        toast.error('Preço a prazo inválido.')
        return null
      }
      return { preco_prazo: n }
    }
    case 'preco_promocional': {
      const t = precoPromocional.value.trim()
      if (!t.length) return { preco_promocional: null }
      const n = parseDecimalPtBr(t)
      if (n == null || n < 0) {
        toast.error('Preço promocional inválido.')
        return null
      }
      return { preco_promocional: n }
    }
    case 'peso_kg': {
      const t = pesoKg.value.trim()
      if (!t.length) return { peso_kg: null }
      const n = parseDecimalPtBr(t)
      if (n == null || n < 0) {
        toast.error('Peso inválido.')
        return null
      }
      return { peso_kg: n }
    }
    case 'infos_relevantes':
      return { infos_relevantes: strOuNull(infosRelevantes.value) }
    default:
      return null
  }
}

function aplicar() {
  const patch = montarPatch()
  if (!patch) return
  emit('aplicar', patch)
}

function fechar() {
  open.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Alterar em massa"
    panel-class="w-full max-w-lg"
    @close="fechar"
  >
    <template #subtitle>
      {{ subtitulo }}
    </template>

    <div class="space-y-4">
      <div>
        <label
          for="edicao-massa-campo"
          class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
        >
          Campo a alterar
        </label>
        <select
          id="edicao-massa-campo"
          v-model="campoSelecionado"
          class="block w-full rounded-xl border border-outline/40 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:shadow-none dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
        >
          <option value="" disabled>Selecione…</option>
          <option v-for="c in CAMPOS" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>
      </div>

      <div v-if="campoSelecionado === 'termos_pesquisa'">
        <label class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Adicionar categoria / termo de pesquisa
        </label>
        <p class="mb-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Os termos selecionados serão incluídos nos produtos; os que já existem não serão removidos.
        </p>
        <ProdutosSelecaoMultipla
          :workspace-id="workspaceId"
          :termos="termosSelecionados"
          @commit="onTermosCommit"
        />
      </div>

      <div v-else-if="campoSelecionado === 'unidade_venda'">
        <label for="edicao-massa-unidade" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Unidade de venda
        </label>
        <BaseInput
          id="edicao-massa-unidade"
          v-model="unidadeVenda"
          placeholder="Ex: UNIDADE, SACO, FARDO, KG"
          autocomplete="off"
        />
      </div>

      <div v-else-if="campoSelecionado === 'marca'">
        <label for="edicao-massa-marca" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Marca
        </label>
        <BaseInput id="edicao-massa-marca" v-model="marca" placeholder="Marca do produto" autocomplete="off" />
      </div>

      <div v-else-if="campoSelecionado === 'preco'">
        <label for="edicao-massa-preco" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço à vista (R$)
        </label>
        <BaseInput id="edicao-massa-preco" v-model="precoVista" type="text" inputmode="decimal" placeholder="Ex: 109,23" />
      </div>

      <div v-else-if="campoSelecionado === 'preco_custo'">
        <label for="edicao-massa-custo" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço de custo (R$)
        </label>
        <BaseInput id="edicao-massa-custo" v-model="precoCusto" type="text" inputmode="decimal" placeholder="Ex: 50,00" />
      </div>

      <div v-else-if="campoSelecionado === 'preco_prazo'">
        <label for="edicao-massa-prazo" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço a prazo (R$)
        </label>
        <BaseInput id="edicao-massa-prazo" v-model="precoPrazo" type="text" inputmode="decimal" placeholder="Ex: 119,90 (vazio = limpar)" />
      </div>

      <div v-else-if="campoSelecionado === 'preco_promocional'">
        <label for="edicao-massa-promo" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço promocional (R$)
        </label>
        <BaseInput id="edicao-massa-promo" v-model="precoPromocional" type="text" inputmode="decimal" placeholder="Ex: 99,90 (vazio = limpar)" />
      </div>

      <div v-else-if="campoSelecionado === 'peso_kg'">
        <label for="edicao-massa-peso" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Peso (kg)
        </label>
        <BaseInput
          id="edicao-massa-peso"
          v-model="pesoKg"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 25,5 (vazio = limpar)"
        />
      </div>

      <div v-else-if="campoSelecionado === 'infos_relevantes'">
        <label for="edicao-massa-infos" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Informações relevantes
        </label>
        <BaseTextarea
          id="edicao-massa-infos"
          v-model="infosRelevantes"
          placeholder="Detalhes importantes do produto"
          :min-height-px="80"
          :max-height-px="180"
          :submit-on-enter="false"
        />
      </div>

      <div v-else-if="campoSelecionado === 'status'" class="space-y-2">
        <span class="block text-sm font-medium text-on-surface dark:text-dark-on-surface">Novo status</span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            :class="
              statusAtivo
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:bg-primary-500 dark:ring-primary-500 dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface'
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
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:bg-primary-500 dark:ring-primary-500 dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface'
            "
            @click="statusAtivo = false"
          >
            Inativo
          </button>
        </div>
      </div>

      <div v-else-if="campoSelecionado === 'envia_foto'" class="space-y-2">
        <span class="block text-sm font-medium text-on-surface dark:text-dark-on-surface">Enviar foto</span>
        <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Define se a IA pode enviar a foto deste produto ao cliente na conversa.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            :class="
              enviaFoto
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:bg-primary-500 dark:ring-primary-500 dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface'
            "
            @click="enviaFoto = true"
          >
            Sim
          </button>
          <button
            type="button"
            class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            :class="
              !enviaFoto
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-2 ring-offset-surface-container-lowest dark:bg-primary-500 dark:ring-primary-500 dark:ring-offset-dark-surface-container-lowest'
                : 'border border-outline/50 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface'
            "
            @click="enviaFoto = false"
          >
            Não
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton type="button" variant="secondary" :block="false" @click="fechar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" variant="primary" :block="false" :disabled="!campoSelecionado" @click="aplicar">
        Salvar
      </BaseButton>
    </template>
  </BaseModal>
</template>
