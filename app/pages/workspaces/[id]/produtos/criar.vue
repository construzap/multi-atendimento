<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ProdutoImportarLinha, ProdutosImportarLoteResponse } from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import CriarProdutoFormulario from '~/components/produtos/criar-produto/CriarProdutoFormulario.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))
const listaProdutosPath = computed(() =>
  workspaceId.value != null ? `/workspaces/${workspaceId.value}/produtos` : '/workspaces',
)

const salvando = ref(false)

const ativo = ref(true)
const nome = ref('')
const codigo = ref('')
const sku = ref('')
const marca = ref('')
const descricao = ref('')
const categoriaSelecao = ref<{ id: number; nome: string } | null>(null)

const precoCusto = ref('')
const precoVista = ref('')
const precoPrazo = ref('')
const precoPromocional = ref('')
const estoqueInicial = ref('0')
const unidadeVenda = ref('')

const pesoKg = ref('')
const codigoBarras = ref('')
const tags = ref<string[]>([])

const podeSalvar = computed(() => nome.value.trim().length > 0 && !salvando.value)

function strOuNull(v: string): string | null {
  const t = v.trim()
  return t.length ? t : null
}

function montarLinha(): ProdutoImportarLinha {
  const precoN = parseDecimalPtBr(precoVista.value) ?? 0
  const precoPrazoN = parseDecimalPtBr(precoPrazo.value)
  const pesoN = parseDecimalPtBr(pesoKg.value)
  const estoqueN = Number.parseInt(estoqueInicial.value.trim(), 10)

  let infos = descricao.value.trim()
  const extras: string[] = []
  if (precoCusto.value.trim()) extras.push(`Preço de custo: ${precoCusto.value.trim()}`)
  if (precoPromocional.value.trim()) extras.push(`Preço promocional: ${precoPromocional.value.trim()}`)
  if (codigoBarras.value.trim()) extras.push(`EAN: ${codigoBarras.value.trim()}`)
  if (tags.value.length) extras.push(`Tags: ${tags.value.join(', ')}`)
  if (extras.length) {
    const bloco = extras.join('\n')
    infos = infos ? `${infos}\n\n${bloco}` : bloco
  }

  const linha: ProdutoImportarLinha = {
    nome: nome.value.trim(),
    sku: strOuNull(sku.value),
    unidade_venda: strOuNull(unidadeVenda.value) || null,
    marca: strOuNull(marca.value),
    preco: precoN,
    preco_prazo: precoPrazoN,
    peso_kg: pesoN,
    estoque: Number.isFinite(estoqueN) ? estoqueN : null,
    infos_relevantes: strOuNull(infos),
    status: ativo.value,
  }
  if (categoriaSelecao.value) {
    linha.categoria_id = categoriaSelecao.value.id
  }
  return linha
}

async function salvar() {
  const wid = workspaceId.value
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
    await navigateTo(listaProdutosPath.value)
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o produto.'))
  } finally {
    salvando.value = false
  }
}

function cancelar() {
  void navigateTo(listaProdutosPath.value)
}
</script>

<template>
  <div
    class="mx-auto w-full min-w-0 max-w-[1200px] space-y-8 bg-background px-4 py-8 md:px-6 dark:bg-dark-background"
  >
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-2">
        <NuxtLink
          :to="listaProdutosPath"
          class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
          Voltar aos produtos
        </NuxtLink>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Criar produto
        </h1>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Preencha as secções abaixo. O código sequencial do produto é gerado ao salvar, salvo indicação em contrário
          na API.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <BaseButton type="button" variant="secondary" :block="false" :disabled="salvando" @click="cancelar">
          Cancelar
        </BaseButton>
        <BaseButton type="button" variant="primary" :block="false" :disabled="!podeSalvar" @click="salvar">
          <span class="inline-flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">save</span>
            {{ salvando ? 'A guardar…' : 'Salvar' }}
          </span>
        </BaseButton>
      </div>
    </header>

    <CriarProdutoFormulario
      :workspace-id="workspaceId"
      v-model:ativo="ativo"
      v-model:nome="nome"
      v-model:codigo="codigo"
      v-model:sku="sku"
      v-model:marca="marca"
      v-model:descricao="descricao"
      v-model:categoria-selecao="categoriaSelecao"
      v-model:preco-custo="precoCusto"
      v-model:preco-vista="precoVista"
      v-model:preco-prazo="precoPrazo"
      v-model:preco-promocional="precoPromocional"
      v-model:estoque-inicial="estoqueInicial"
      v-model:unidade-venda="unidadeVenda"
      v-model:peso-kg="pesoKg"
      v-model:codigo-barras="codigoBarras"
      v-model:tags="tags"
    />

    <footer
      class="flex flex-wrap items-center justify-end gap-2 border-t border-outline/20 pt-6 dark:border-dark-outline/20"
    >
      <BaseButton type="button" variant="secondary" :block="false" :disabled="salvando" @click="cancelar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" variant="primary" :block="false" :disabled="!podeSalvar" @click="salvar">
        <span class="inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">save</span>
          {{ salvando ? 'A guardar…' : 'Salvar produto' }}
        </span>
      </BaseButton>
    </footer>
  </div>
</template>
