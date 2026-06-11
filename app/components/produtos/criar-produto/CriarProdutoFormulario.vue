<script setup lang="ts">
/**
 * Agrupa todas as secções do fluxo «Criar produto».
 * A página futura pode importar só este componente ou cada secção à parte.
 */
import CriarProdutoConteudoExtra from './CriarProdutoConteudoExtra.vue'
import CriarProdutoDicaPro from './CriarProdutoDicaPro.vue'
import CriarProdutoInformacoesBasicas from './CriarProdutoInformacoesBasicas.vue'
import CriarProdutoLogistica from './CriarProdutoLogistica.vue'
import CriarProdutoPrecosEstoque from './CriarProdutoPrecosEstoque.vue'
import CriarProdutoVariacoes from './CriarProdutoVariacoes.vue'
import type { CriarProdutoTipoImagensVariacao } from './types'

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    idPrefix?: string
  }>(),
  {
    workspaceId: null,
    idPrefix: 'criar-produto',
  },
)

const ativo = defineModel<boolean>('ativo', { default: true })
const nome = defineModel<string>('nome', { default: '' })
const codigo = defineModel<string>('codigo', { default: '' })
const sku = defineModel<string>('sku', { default: '' })
const marca = defineModel<string>('marca', { default: '' })
const descricao = defineModel<string>('descricao', { default: '' })
const categoriaSelecao = defineModel<{ id: number; nome: string } | null>('categoriaSelecao', { default: null })

const precoCusto = defineModel<string>('precoCusto', { default: '' })
const precoVista = defineModel<string>('precoVista', { default: '' })
const precoPrazo = defineModel<string>('precoPrazo', { default: '' })
const precoPromocional = defineModel<string>('precoPromocional', { default: '' })
const estoqueInicial = defineModel<string>('estoqueInicial', { default: '0' })
const unidadeVenda = defineModel<string>('unidadeVenda', { default: '' })

const tipoImagensVariacao = defineModel<CriarProdutoTipoImagensVariacao>('tipoImagensVariacao', { default: 'diferentes' })

const pesoKg = defineModel<string>('pesoKg', { default: '' })
const larguraCm = defineModel<string>('larguraCm', { default: '' })
const alturaCm = defineModel<string>('alturaCm', { default: '' })
const comprimentoCm = defineModel<string>('comprimentoCm', { default: '' })
const codigoNcm = defineModel<string>('codigoNcm', { default: '' })

const codigoBarras = defineModel<string>('codigoBarras', { default: '' })
const tags = defineModel<string[]>('tags', { default: () => [] })
</script>

<template>
  <div class="space-y-6">
    <CriarProdutoInformacoesBasicas
      :workspace-id="workspaceId"
      :id-prefix="idPrefix"
      v-model:ativo="ativo"
      v-model:nome="nome"
      v-model:codigo="codigo"
      v-model:sku="sku"
      v-model:marca="marca"
      v-model:descricao="descricao"
      v-model:categoria-selecao="categoriaSelecao"
    />
    <CriarProdutoPrecosEstoque
      :id-prefix="idPrefix"
      v-model:preco-custo="precoCusto"
      v-model:preco-vista="precoVista"
      v-model:preco-prazo="precoPrazo"
      v-model:preco-promocional="precoPromocional"
      v-model:estoque-inicial="estoqueInicial"
      v-model:unidade-venda="unidadeVenda"
    />
    <CriarProdutoVariacoes :id-prefix="idPrefix" v-model:tipo-imagens="tipoImagensVariacao" />
    <CriarProdutoLogistica
      :id-prefix="idPrefix"
      v-model:peso-kg="pesoKg"
      v-model:largura-cm="larguraCm"
      v-model:altura-cm="alturaCm"
      v-model:comprimento-cm="comprimentoCm"
      v-model:codigo-ncm="codigoNcm"
    />
    <CriarProdutoConteudoExtra
      :id-prefix="idPrefix"
      v-model:codigo-barras="codigoBarras"
      v-model:tags="tags"
    />
    <CriarProdutoDicaPro />
  </div>
</template>
