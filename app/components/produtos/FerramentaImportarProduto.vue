<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ProdutosImportarLoteResponse } from '#shared/types/produtos'
import MapeamentoDeColunas from '~/components/produtos/MapeamentoDeColunas.vue'
import ProdutosModalImportarProgresso from '~/components/produtos/ProdutosModalImportarProgresso.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { extrairMetadadosPlanilhaImportacao, lerTodasLinhasPlanilha } from '~/utils/extrairCabecalhosPlanilha'
import { construirLinhasImportacaoProduto, mapeamentoTemNome } from '~/utils/mapearLinhasImportacaoProduto'

const TAMANHO_LOTE_IMPORTACAO = 50

type ImportacaoFaseLocal = 'idle' | 'lendo' | 'enviando' | 'concluido' | 'erro'

const ACCEPT_IMPORT =
  '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const emit = defineEmits<{
  importado: []
}>()

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    termoBusca?: string
  }>(),
  {
    workspaceId: null,
    termoBusca: '',
  },
)

const produtosStore = useProdutosStore()

const importacaoEmAndamento = ref(false)
const importacaoFase = ref<ImportacaoFaseLocal>('idle')
const importacaoProcessadas = ref(0)
const importacaoTotal = ref(0)
const importacaoErro = ref<string | null>(null)

const modalImportarAberto = ref(false)
const modalProgressoAberto = ref(false)
const inputImportarRef = ref<HTMLInputElement | null>(null)
const arquivoImportacao = ref<File | null>(null)
const nomeArquivoImportacao = ref<string | null>(null)
const colunasSuaTabela = ref<string[]>([])
const exemplosColunas = ref<string[]>([])
const totalLinhasDadosPlanilha = ref(0)

function limparEstadoImportacao() {
  importacaoEmAndamento.value = false
  importacaoFase.value = 'idle'
  importacaoProcessadas.value = 0
  importacaoTotal.value = 0
  importacaoErro.value = null
}

function extensaoImportacaoPermitida(nome: string): boolean {
  const n = nome.trim().toLowerCase()
  return n.endsWith('.csv') || n.endsWith('.xls') || n.endsWith('.xlsx')
}

function abrirSeletorImportacao() {
  inputImportarRef.value?.click()
}

async function aoEscolherArquivoImportacao(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  void nextTick(() => {
    input.value = ''
  })
  if (!file) return
  if (!extensaoImportacaoPermitida(file.name)) {
    toast.error('Selecione um arquivo .csv, .xls ou .xlsx.')
    return
  }

  try {
    const meta = await extrairMetadadosPlanilhaImportacao(file)
    colunasSuaTabela.value = meta.cabecalhos
    exemplosColunas.value = meta.exemplos
    totalLinhasDadosPlanilha.value = meta.totalLinhasDados
    arquivoImportacao.value = file
    nomeArquivoImportacao.value = file.name
    modalImportarAberto.value = true
    if (!meta.cabecalhos.length) {
      toast.warning('Nenhuma coluna encontrada na primeira linha. Confira se a primeira linha tem os títulos.')
    }
  } catch {
    toast.error('Não foi possível ler o arquivo. Tente outro formato ou ficheiro.')
  }
}

watch(modalImportarAberto, (aberto) => {
  if (!aberto) {
    arquivoImportacao.value = null
    nomeArquivoImportacao.value = null
    colunasSuaTabela.value = []
    exemplosColunas.value = []
    totalLinhasDadosPlanilha.value = 0
  }
})

async function executarImportacao(
  workspaceId: number,
  file: File,
  mapeamentoPorIndice: Record<number, string>,
) {
  limparEstadoImportacao()
  importacaoEmAndamento.value = true
  importacaoFase.value = 'lendo'
  importacaoErro.value = null
  importacaoProcessadas.value = 0
  importacaoTotal.value = 0

  try {
    const todasLinhas = await lerTodasLinhasPlanilha(file)
    const linhas = construirLinhasImportacaoProduto(todasLinhas, mapeamentoPorIndice)
    importacaoTotal.value = linhas.length

    if (linhas.length === 0) {
      throw new Error(
        'Nenhuma linha válida para importar. Mapeie a coluna «Nome» e confira se há dados nas linhas.',
      )
    }

    importacaoFase.value = 'enviando'

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE_IMPORTACAO) {
      const chunk = linhas.slice(i, i + TAMANHO_LOTE_IMPORTACAO)
      await $fetch<ProdutosImportarLoteResponse>('/api/produtos/importar', {
        method: 'POST',
        body: {
          workspace_id: workspaceId,
          linhas: chunk,
        },
      })
      importacaoProcessadas.value += chunk.length
    }

    produtosStore.ultimoSnapshotKey = null
    produtosStore.page = 1
    await produtosStore.fetchPagina(workspaceId, {
      page: 1,
      q: props.termoBusca ?? '',
    })
    useProdutoTermosPesquisaStore().invalidarWorkspace(workspaceId)
    importacaoFase.value = 'concluido'
    emit('importado')
  } catch (err) {
    importacaoFase.value = 'erro'
    importacaoErro.value = mensagemErroFetch(err, 'Não foi possível concluir a importação.')
  } finally {
    importacaoEmAndamento.value = false
  }
}

async function aoConfirmarImportacaoMapeamento(payload: {
  mapeamentoPorIndice: Record<number, string>
  totalLinhasDados: number
}) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    toast.error('Workspace inválido. Recarregue a página.')
    return
  }

  if (!mapeamentoTemNome(payload.mapeamentoPorIndice)) {
    toast.error('Mapeie pelo menos uma coluna para o campo «Nome».')
    return
  }

  const file = arquivoImportacao.value
  if (!file) {
    toast.error('Arquivo não encontrado. Selecione o ficheiro novamente.')
    return
  }

  modalImportarAberto.value = false

  await nextTick()
  modalProgressoAberto.value = true

  await executarImportacao(wid, file, payload.mapeamentoPorIndice)

  if (importacaoFase.value === 'concluido') {
    toast.success('Produtos importados com sucesso.')
  }
}

function aoFecharModalProgresso() {
  limparEstadoImportacao()
}

defineExpose({
  abrirSeletorImportacao,
})
</script>

<template>
  <input
    ref="inputImportarRef"
    type="file"
    class="sr-only"
    tabindex="-1"
    :accept="ACCEPT_IMPORT"
    aria-hidden="true"
    @change="aoEscolherArquivoImportacao"
  />
  <MapeamentoDeColunas
    v-model:open="modalImportarAberto"
    :nome-arquivo="nomeArquivoImportacao"
    :arquivo="arquivoImportacao"
    :colunas-sua-tabela="colunasSuaTabela"
    :exemplos-colunas="exemplosColunas"
    :total-linhas-dados="totalLinhasDadosPlanilha"
    @confirmar-importacao="aoConfirmarImportacaoMapeamento"
  />
  <ProdutosModalImportarProgresso
    v-model:open="modalProgressoAberto"
    :em-andamento="importacaoEmAndamento"
    :processadas="importacaoProcessadas"
    :total="importacaoTotal"
    :fase="importacaoFase"
    :mensagem-erro="importacaoErro"
    @fechar="aoFecharModalProgresso"
  />
</template>
