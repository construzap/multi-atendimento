<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ProdutoImportarLinha, ProdutosImportarLoteResponse } from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
  }>(),
  {
    workspaceId: null,
  },
)

const emit = defineEmits<{
  gravado: []
}>()

const nome = ref('')
const categoriaSelecionada = ref<{ id: number; nome: string } | null>(null)
const sku = ref('')
const unidadeVenda = ref('')
const marca = ref('')
const preco = ref('')
const precoPrazo = ref('')
const pesoKg = ref('')
const infosRelevantes = ref('')
const imagemUrl = ref('')
const statusAtivo = ref(true)
const imagemPreviewOculta = ref(false)
const salvando = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) {
    nome.value = ''
    categoriaSelecionada.value = null
    sku.value = ''
    unidadeVenda.value = ''
    marca.value = ''
    preco.value = ''
    precoPrazo.value = ''
    pesoKg.value = ''
    infosRelevantes.value = ''
    imagemUrl.value = ''
    statusAtivo.value = true
    imagemPreviewOculta.value = false
    salvando.value = false
  }
})

watch(imagemUrl, () => {
  imagemPreviewOculta.value = false
})

const podeSalvar = computed(() => {
  const n = nome.value.trim()
  return n.length > 0 && !salvando.value
})

function strOuNull(v: string): string | null {
  const t = v.trim()
  return t.length ? t : null
}

function montarLinha(): ProdutoImportarLinha {
  const precoN = parseDecimalPtBr(preco.value) ?? 0
  const precoPrazoN = parseDecimalPtBr(precoPrazo.value)
  const pesoN = parseDecimalPtBr(pesoKg.value)
  const linha: ProdutoImportarLinha = {
    nome: nome.value.trim(),
    sku: strOuNull(sku.value),
    unidade_venda: strOuNull(unidadeVenda.value),
    marca: strOuNull(marca.value),
    preco: precoN,
    preco_prazo: precoPrazoN,
    peso_kg: pesoN,
    estoque: null,
    imagem_url: strOuNull(imagemUrl.value),
    infos_relevantes: strOuNull(infosRelevantes.value),
    status: statusAtivo.value,
  }
  if (categoriaSelecionada.value) {
    linha.categoria_id = categoriaSelecionada.value.id
  }
  return linha
}

async function salvar() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    toast.error('Workspace inválido.')
    return
  }
  if (!nome.value.trim()) {
    toast.error('Informe o nome do produto.')
    return
  }

  salvando.value = true
  try {
    await $fetch<ProdutosImportarLoteResponse>('/api/produtos/importar', {
      method: 'POST',
      body: {
        workspace_id: wid,
        linhas: [montarLinha()],
      },
    })
    toast.success('Produto criado.')
    open.value = false
    emit('gravado')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o produto.'))
  } finally {
    salvando.value = false
  }
}

function fechar() {
  open.value = false
}
</script>

<template>
  <BaseModal v-model:open="open" title="Novo produto" panel-class="w-full max-w-3xl">
    <template #subtitle>
      O código do produto é gerado automaticamente ao salvar. Cada produto tem no máximo uma categoria: pesquise,
      escolha na lista ou crie uma nova se não aparecer nenhuma correspondência.
    </template>

    <div class="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
      <div class="md:col-span-2">
        <label for="produto-novo-nome" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Produto
        </label>
        <BaseInput id="produto-novo-nome" v-model="nome" placeholder="Nome do produto" autocomplete="off" />
      </div>

      <div class="md:col-span-2">
        <label for="produto-novo-categoria" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Categoria
        </label>
        <ProdutosSelecaoUnica
          variant="form"
          :workspace-id="workspaceId"
          :ativo="open"
          v-model:selecao="categoriaSelecionada"
          input-id="produto-novo-categoria"
          placeholder="Comece a digitar para buscar…"
        />
      </div>

      <div>
        <label for="produto-novo-sku" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          SKU
        </label>
        <BaseInput id="produto-novo-sku" v-model="sku" placeholder="Código / SKU" autocomplete="off" />
      </div>

      <div>
        <label for="produto-novo-unidade" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Unidade de venda
        </label>
        <BaseInput id="produto-novo-unidade" v-model="unidadeVenda" placeholder="Ex: UN, CX, KG" autocomplete="off" />
      </div>

      <div>
        <label for="produto-novo-marca" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Marca
        </label>
        <BaseInput id="produto-novo-marca" v-model="marca" placeholder="Marca do produto" autocomplete="off" />
      </div>

      <div>
        <label for="produto-novo-preco" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço (R$)
        </label>
        <BaseInput
          id="produto-novo-preco"
          v-model="preco"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 109,23"
          autocomplete="off"
        />
      </div>
      <div>
        <label for="produto-novo-preco-prazo" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Preço a prazo (R$)
        </label>
        <BaseInput
          id="produto-novo-preco-prazo"
          v-model="precoPrazo"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 109,23"
          autocomplete="off"
        />
      </div>

      <div class="md:col-span-2 md:max-w-[calc(50%-0.625rem)]">
        <label for="produto-novo-peso" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Peso (kg)
        </label>
        <BaseInput
          id="produto-novo-peso"
          v-model="pesoKg"
          type="text"
          inputmode="decimal"
          placeholder="Ex: 1,2"
          autocomplete="off"
        />
      </div>

      <div class="md:col-span-2">
        <label for="produto-novo-imagem" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          URL da imagem
        </label>
        <BaseInput id="produto-novo-imagem" v-model="imagemUrl" type="url" placeholder="https://…" autocomplete="off" />
        <div v-if="imagemUrl.trim() && !imagemPreviewOculta" class="mt-3 flex items-center gap-3">
          <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">Pré-visualização</p>
          <img
            :src="imagemUrl.trim()"
            alt=""
            class="h-14 w-14 rounded-lg border border-outline/30 object-cover dark:border-dark-outline/30"
            loading="lazy"
            @error="imagemPreviewOculta = true"
          />
        </div>
        <p v-else-if="imagemUrl.trim() && imagemPreviewOculta" class="mt-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Não foi possível carregar a imagem desta URL.
        </p>
      </div>

      <div class="md:col-span-2">
        <label for="produto-novo-infos" class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
          Informações relevantes
        </label>
        <BaseTextarea
          id="produto-novo-infos"
          v-model="infosRelevantes"
          placeholder="Detalhes importantes do produto"
          :min-height-px="80"
          :max-height-px="220"
          :submit-on-enter="false"
        />
      </div>

      <div class="md:col-span-2">
        <span class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface">Status</span>
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
