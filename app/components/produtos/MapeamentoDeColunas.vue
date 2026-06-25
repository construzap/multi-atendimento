<script setup lang="ts">
import ModalMapeamentoDeColunas from '~/components/ModalMapeamentoDeColunas.vue'
import { CAMPOS_TABELA_IA_PRODUTO } from '~/constants/produtosCamposIa'

defineOptions({ name: 'MAPEAMENTODECOLUNAS' })

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  nomeArquivo?: string | null
  arquivo?: File | null
  colunasSuaTabela?: string[]
  exemplosColunas?: string[]
  totalLinhasDados?: number
}>()

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
}>()
</script>

<template>
  <ModalMapeamentoDeColunas
    v-model:open="open"
    :nome-arquivo="nomeArquivo"
    :arquivo="arquivo"
    :colunas-sua-tabela="colunasSuaTabela"
    :exemplos-colunas="exemplosColunas"
    :total-linhas-dados="totalLinhasDados"
    :campos="CAMPOS_TABELA_IA_PRODUTO"
    :campos-unicos="['categoria', 'termos_pesquisa']"
    :campos-obrigatorios="['nome']"
    label-coluna-destino="Tabela da I.A"
    @confirmar-importacao="emit('confirmarImportacao', $event)"
  >
    <template #subtitle="{ totalLinhasDados: total }">
      <span class="block leading-relaxed">
        Conecte as colunas do seu arquivo aos campos da nossa tabela. Cada produto admite
        <strong class="text-on-surface dark:text-dark-on-surface">uma única categoria</strong>
        — só pode haver uma coluna mapeada para «Categoria».
        «Termos pesquisa» usa o <strong class="text-on-surface dark:text-dark-on-surface">texto completo da célula</strong>
        como um único termo (ex.: «tijolinho, tijolao e bloco» vira um termo só).
        <template v-if="total > 0">
          Detectamos <strong class="text-on-surface dark:text-dark-on-surface">{{ total }}</strong> registros.
        </template>
      </span>
    </template>
  </ModalMapeamentoDeColunas>
</template>
