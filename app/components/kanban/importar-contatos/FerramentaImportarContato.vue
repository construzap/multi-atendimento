<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ContatosImportarLoteResponse } from '#shared/types/contato'
import MapeamentoDeColunas from '~/components/kanban/importar-contatos/MapeamentoDeColunas.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useAtendentesStore } from '~/stores/atendentes'
import { useKanbanStore } from '~/stores/kanban'
import { extrairMetadadosPlanilhaImportacao, lerTodasLinhasPlanilha } from '~/utils/extrairCabecalhosPlanilha'
import {
  construirLinhasImportacaoContato,
  mensagemDiagnosticoImportacaoContato,
  mapeamentoTemIdCanal,
  mapeamentoTemNome,
  mapeamentoTemPhone,
} from '~/utils/mapearLinhasImportacaoContato'

const TAMANHO_LOTE_IMPORTACAO = 50

const ACCEPT_IMPORT =
  '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const props = defineProps<{
  workspaceId: number
}>()

const emit = defineEmits<{
  importado: []
}>()

const canaisStore = useCanaisStore()
const kanbanStore = useKanbanStore()
const atendentesStore = useAtendentesStore()

const importacaoEmAndamento = ref(false)
const importacaoProcessadas = ref(0)
const importacaoTotal = ref(0)
const importacaoErro = ref<string | null>(null)
const abortImportacao = ref(false)

const modalImportarAberto = ref(false)
const modalProgressoAberto = ref(false)
const inputImportarRef = ref<HTMLInputElement | null>(null)
const arquivoImportacao = ref<File | null>(null)
const nomeArquivoImportacao = ref<string | null>(null)
const colunasSuaTabela = ref<string[]>([])
const exemplosColunas = ref<string[]>([])
const totalLinhasDadosPlanilha = ref(0)

const importacaoConcluida = computed(
  () =>
    !importacaoEmAndamento.value &&
    importacaoTotal.value > 0 &&
    importacaoProcessadas.value >= importacaoTotal.value &&
    !importacaoErro.value,
)

function limparEstadoImportacao() {
  importacaoEmAndamento.value = false
  importacaoProcessadas.value = 0
  importacaoTotal.value = 0
  importacaoErro.value = null
  abortImportacao.value = false
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
): Promise<boolean> {
  limparEstadoImportacao()
  importacaoEmAndamento.value = true
  importacaoErro.value = null
  importacaoProcessadas.value = 0
  importacaoTotal.value = 0
  abortImportacao.value = false

  try {
    await Promise.all([
      canaisStore.ensureCanaisLoaded(workspaceId).catch(() => {}),
      kanbanStore.ensureBoardLoaded(workspaceId).catch(() => {}),
      atendentesStore.ensureListLoaded(workspaceId).catch(() => {}),
    ])

    const canaisPorNome = new Map<string, number>()
    for (const canal of canaisStore.items) {
      const nome = canal.nome?.trim()
      if (nome) canaisPorNome.set(nome.toLowerCase(), canal.id)
    }

    const colunasPorNome = new Map<string, number>()
    for (const coluna of kanbanStore.columns) {
      const nome = coluna.nome?.trim()
      if (nome) colunasPorNome.set(nome.toLowerCase(), coluna.id)
    }

    const atendentesPorEmail = new Map<string, string>()
    for (const atendente of atendentesStore.items) {
      const email = atendente.email?.trim()
      if (!email) continue
      const key = email.toLowerCase()
      atendentesPorEmail.set(key, key)
    }

    const todasLinhas = await lerTodasLinhasPlanilha(file, { raw: true })
    const { linhas, diagnostico } = construirLinhasImportacaoContato(
      todasLinhas,
      mapeamentoPorIndice,
      { canaisPorNome, colunasPorNome, atendentesPorEmail },
    )
    importacaoTotal.value = linhas.length

    if (linhas.length === 0) {
      throw new Error(mensagemDiagnosticoImportacaoContato(diagnostico))
    }

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE_IMPORTACAO) {
      if (abortImportacao.value) {
        throw new Error('Importação cancelada.')
      }

      const chunk = linhas.slice(i, i + TAMANHO_LOTE_IMPORTACAO)
      await $fetch<ContatosImportarLoteResponse>('/api/contatos/importar', {
        method: 'POST',
        body: {
          workspace_id: workspaceId,
          linhas: chunk,
        },
      })
      importacaoProcessadas.value += chunk.length
    }

    await kanbanStore.fetchBoard(workspaceId)
    emit('importado')
    return true
  } catch (err) {
    importacaoErro.value = mensagemErroFetch(err, 'Não foi possível concluir a importação.')
    return false
  } finally {
    importacaoEmAndamento.value = false
  }
}

async function aoConfirmarImportacaoMapeamento(payload: {
  mapeamentoPorIndice: Record<number, string>
  totalLinhasDados: number
}) {
  const wid = props.workspaceId
  if (!Number.isFinite(wid) || wid < 1) {
    toast.error('Workspace inválido. Recarregue a página.')
    return
  }

  if (!mapeamentoTemNome(payload.mapeamentoPorIndice)) {
    toast.error('Mapeie pelo menos uma coluna para o campo «Nome».')
    return
  }

  if (!mapeamentoTemPhone(payload.mapeamentoPorIndice)) {
    toast.error('Mapeie pelo menos uma coluna para o campo «Telefone».')
    return
  }

  if (!mapeamentoTemIdCanal(payload.mapeamentoPorIndice)) {
    toast.error('Mapeie pelo menos uma coluna para o campo «ID do canal».')
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

  const ok = await executarImportacao(wid, file, payload.mapeamentoPorIndice)

  if (ok) {
    const qtd = importacaoProcessadas.value
    modalProgressoAberto.value = false
    toast.success(
      qtd === 1 ? '1 contato importado com sucesso.' : `${qtd} contatos importados com sucesso.`,
    )
  }
}

function aoCancelarImportacao() {
  if (importacaoEmAndamento.value) {
    abortImportacao.value = true
    return
  }
  modalProgressoAberto.value = false
  limparEstadoImportacao()
}

function aoFecharModalProgresso() {
  if (importacaoEmAndamento.value) return
  limparEstadoImportacao()
}

watch(modalProgressoAberto, (aberto) => {
  if (!aberto) aoFecharModalProgresso()
})

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
    :workspace-id="workspaceId"
    :nome-arquivo="nomeArquivoImportacao"
    :arquivo="arquivoImportacao"
    :colunas-sua-tabela="colunasSuaTabela"
    :exemplos-colunas="exemplosColunas"
    :total-linhas-dados="totalLinhasDadosPlanilha"
    @confirmar-importacao="aoConfirmarImportacaoMapeamento"
  />
  <ModalEnvioProdutos
    v-model:open="modalProgressoAberto"
    title="Importando contatos…"
    :total="importacaoTotal"
    :enviados="importacaoProcessadas"
    :erro="importacaoErro"
    :pode-cancelar="importacaoEmAndamento || !!importacaoErro || importacaoConcluida"
    @cancelar="aoCancelarImportacao"
  >
    <template #extra>
      <p
        v-if="importacaoEmAndamento"
        class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Enviando em lotes de {{ TAMANHO_LOTE_IMPORTACAO }} registros. Os cards aparecerão no kanban após a importação.
      </p>
      <p
        v-else-if="importacaoConcluida"
        class="text-sm font-medium text-emerald-700 dark:text-emerald-300"
      >
        Importação concluída.
      </p>
    </template>
  </ModalEnvioProdutos>
</template>
