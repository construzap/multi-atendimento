<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import ModalMapeamentoDeColunas from '~/components/ModalMapeamentoDeColunas.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalCriarCampoPersonalizado from '~/components/kanban/InfoContatoKanban/ModalCriarCampoPersonalizado.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useAtendentesStore } from '~/stores/atendentes'
import { useCamposPersonalizadosStore } from '~/stores/camposPersonalizados'
import { useContatosStore } from '~/stores/contatos'
import { useKanbanStore } from '~/stores/kanban'
import type { CampoPersonalizado } from '#shared/types/camposPersonalizados'
import {
  MAPEAMENTO_FUNIL_ATENDENTE_ID,
  MAPEAMENTO_FUNIL_COLUNA_ID,
  type CampoMapeamentoColuna,
} from '~/utils/mapeamentoColunasImportacao'

defineOptions({ name: 'ContatosMapeamentoDeColunas' })

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

const route = useRoute()
const contatosStore = useContatosStore()
const camposPersonalizadosStore = useCamposPersonalizadosStore()
const kanbanStore = useKanbanStore()
const atendentesStore = useAtendentesStore()

const { camposMapeamento, camposObrigatoriosImportacao } = storeToRefs(contatosStore)
const { campos } = storeToRefs(camposPersonalizadosStore)

const modalCampoAberto = ref(false)
const modalExcluirCampo = ref(false)
const campoEmEdicao = ref<CampoPersonalizado | null>(null)
const campoParaExcluir = ref<CampoPersonalizado | null>(null)
const excluindoCampo = ref(false)

function parseWorkspaceId(): number | null {
  const raw = route.params.id
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parseWorkspaceId())

const camposPersonalizadosMapeamento = computed((): CampoMapeamentoColuna[] =>
  campos.value.map((c) => ({
    id: `cp:${c.id}`,
    label: c.nome,
  })),
)

function resumirLista(textos: string[], max = 4): string {
  if (!textos.length) return ''
  if (textos.length <= max) return textos.join(' · ')
  return `${textos.slice(0, max).join(' · ')} · +${textos.length - max}`
}

const camposFunilMapeamento = computed((): CampoMapeamentoColuna[] => {
  const colunasDesc = resumirLista(
    kanbanStore.columns.map((col) => `${col.nome} (ID ${col.id})`),
  )
  const atendentesDesc = resumirLista(
    atendentesStore.items
      .map((a) => a.email?.trim())
      .filter((email): email is string => Boolean(email)),
  )

  return [
    {
      id: MAPEAMENTO_FUNIL_COLUNA_ID,
      label: 'Coluna do funil (ID)',
      descricao: colunasDesc || 'Carregue o kanban do workspace para ver as colunas disponíveis.',
    },
    {
      id: MAPEAMENTO_FUNIL_ATENDENTE_ID,
      label: 'Atendente (e-mail)',
      descricao: atendentesDesc || 'Nenhum atendente com e-mail cadastrado neste workspace.',
    },
  ]
})

const textoConfirmarExclusaoCampo = computed(() => {
  const nome = campoParaExcluir.value?.nome?.trim()
  if (!nome) {
    return 'Deseja excluir este campo personalizado? Os valores salvos nas conversas também serão removidos.'
  }
  return `Deseja excluir o campo "${nome}"? Os valores salvos nas conversas também serão removidos.`
})

function parseCampoPersonalizadoId(mapeamentoId: string): number | null {
  if (!mapeamentoId.startsWith('cp:')) return null
  const n = Number.parseInt(mapeamentoId.slice(3), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function campoPorMapeamentoId(mapeamentoId: string): CampoPersonalizado | null {
  const id = parseCampoPersonalizadoId(mapeamentoId)
  if (id == null) return null
  return campos.value.find((c) => c.id === id) ?? null
}

async function garantirCamposPersonalizados() {
  const wid = workspaceId.value
  if (wid == null) return

  try {
    await camposPersonalizadosStore.fetchCampos(wid)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os campos personalizados.'), {
      duration: 8000,
    })
  }
}

async function garantirDadosFunil() {
  const wid = workspaceId.value
  if (wid == null) return

  const tarefas: Promise<unknown>[] = [atendentesStore.ensureListLoaded(wid)]

  tarefas.push(kanbanStore.ensureBoardLoaded(wid))

  try {
    await Promise.all(tarefas)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar dados do funil.'), {
      duration: 8000,
    })
  }
}

function abrirModalCriarCampo() {
  campoEmEdicao.value = null
  modalCampoAberto.value = true
}

function abrirModalEditarCampo(mapeamentoId: string) {
  const campo = campoPorMapeamentoId(mapeamentoId)
  if (!campo) return
  campoEmEdicao.value = campo
  modalCampoAberto.value = true
}

function solicitarExcluirCampo(mapeamentoId: string) {
  const campo = campoPorMapeamentoId(mapeamentoId)
  if (!campo) return
  campoParaExcluir.value = campo
  modalExcluirCampo.value = true
}

async function confirmarExcluirCampo() {
  const campo = campoParaExcluir.value
  const wid = workspaceId.value
  if (!campo || wid == null) {
    modalExcluirCampo.value = false
    return
  }

  excluindoCampo.value = true
  try {
    await camposPersonalizadosStore.excluirCampo(wid, campo.id)
    toast.success('Campo personalizado excluído.')
    modalExcluirCampo.value = false
    campoParaExcluir.value = null
  } catch {
    toast.error(camposPersonalizadosStore.error ?? 'Não foi possível excluir o campo.', {
      duration: 8000,
    })
  } finally {
    excluindoCampo.value = false
  }
}

watch(open, (aberto) => {
  if (aberto) {
    void garantirCamposPersonalizados()
    void garantirDadosFunil()
  }
})

watch(modalCampoAberto, (aberto) => {
  if (!aberto) campoEmEdicao.value = null
})

watch(modalExcluirCampo, (aberto) => {
  if (!aberto && !excluindoCampo.value) campoParaExcluir.value = null
})
</script>

<template>
  <ModalMapeamentoDeColunas
    v-model:open="open"
    :nome-arquivo="nomeArquivo"
    :arquivo="arquivo"
    :colunas-sua-tabela="colunasSuaTabela"
    :exemplos-colunas="exemplosColunas"
    :total-linhas-dados="totalLinhasDados"
    :campos="camposMapeamento"
    :campos-personalizados="camposPersonalizadosMapeamento"
    :campos-funil="camposFunilMapeamento"
    :campos-obrigatorios="camposObrigatoriosImportacao"
    mostrar-botao-criar-campo
    mostrar-acoes-campos-personalizados
    label-coluna-destino="Contatos"
    @confirmar-importacao="emit('confirmarImportacao', $event)"
    @criar-campo="abrirModalCriarCampo"
    @editar-campo-personalizado="abrirModalEditarCampo"
    @excluir-campo-personalizado="solicitarExcluirCampo"
  >
    <template #subtitle="{ totalLinhasDados: total }">
      <span class="block leading-relaxed">
        Conecte as colunas do seu arquivo aos campos de contato.
        É obrigatório mapear pelo menos uma coluna para
        <strong class="text-on-surface dark:text-dark-on-surface">Nome</strong>,
        <strong class="text-on-surface dark:text-dark-on-surface">Telefone</strong>
        e
        <strong class="text-on-surface dark:text-dark-on-surface">ID do canal</strong>.
        <template v-if="total > 0">
          Detectamos <strong class="text-on-surface dark:text-dark-on-surface">{{ total }}</strong> registros.
        </template>
      </span>
    </template>
  </ModalMapeamentoDeColunas>

  <ModalCriarCampoPersonalizado
    v-if="workspaceId != null"
    v-model:open="modalCampoAberto"
    :workspace-id="workspaceId"
    :campo="campoEmEdicao"
    @salvo="garantirCamposPersonalizados"
  />

  <ModalAlerta
    v-model:open="modalExcluirCampo"
    title="Excluir campo personalizado"
    :texto="textoConfirmarExclusaoCampo"
    variante="perigo"
    texto-confirmar="Excluir"
    :confirmar-desabilitado="excluindoCampo"
    @confirmar="confirmarExcluirCampo"
  />
</template>
