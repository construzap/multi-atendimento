<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  Cobranca,
  CriarCobrancaResponse,
  TipoCobranca,
  FrequenciaRecorrencia,
  FrequenciaCobranca,
} from '#shared/types/cobranca'
import {
  defaultFusoDoNavegador,
  isIanaFusoBrasilPermitido,
} from '#shared/constants/ianaTimezonesBrasil'
import { dataHoraLocalEmFuso } from '#shared/utils/agendamentoDataUtc'
import Cliente from '~/components/cobranca/criar-cobranca/cliente/Cliente.vue'
import Mensagem from '~/components/cobranca/criar-cobranca/mensagem/Mensagem.vue'
import Pagamento from '~/components/cobranca/criar-cobranca/pagamento/Pagamento.vue'
import Produtos from '~/components/cobranca/criar-cobranca/produtos/Produtos.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useCobrancaStore } from '~/stores/cobranca'
import { useWorkspacesStore } from '~/stores/workspaces'

type ProdutoCobrancaItem = {
  id: number
  produtoId: number | null
  nome: string
  unidadeVenda: string
  quantidade: number
  precoUnitario: string
}

const props = withDefaults(
  defineProps<{
    /** Se informado, abre o wizard em modo edição com dados do Pinia. */
    cobrancaId?: number | null
  }>(),
  {
    cobrancaId: null,
  },
)

const passos = [
  { id: 1, label: 'Cliente' },
  { id: 2, label: 'Produtos' },
  { id: 3, label: 'Pagamento' },
  { id: 4, label: 'Mensagem' },
] as const

const passoAtual = ref(1)
const salvando = ref(false)

const emit = defineEmits<{
  close: []
  created: []
  updated: []
}>()

const workspaces = useWorkspacesStore()
const cobrancaStore = useCobrancaStore()

const workspaceId = computed<number | null>(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

const modoEdicao = computed(() => props.cobrancaId != null && props.cobrancaId > 0)

const clienteSelecionado = ref('')
const clienteNome = ref('')
const clienteTelefone = ref('')
const canalSelecionado = ref(0)

const produtos = ref<ProdutoCobrancaItem[]>([])

function agoraDataLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function agoraHoraLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const tipoCobranca = ref<TipoCobranca>('unico')
const dataProximaLocal = ref(agoraDataLocal())
const horaProximaLocal = ref(agoraHoraLocal())
const ianaTimezone = ref(defaultFusoDoNavegador())
const totalParcelas = ref(3)
const frequenciaRecorrencia = ref<FrequenciaRecorrencia>('mensal')
const frequenciaCobranca = ref<FrequenciaCobranca>('semanal')
const dataFim = ref('')

const templateMensagem = ref(
  '{saudacao} {cliente}, tudo bem? Sua cobrança no valor de {valor} vence em {vencimento}. Produtos: {produtos}.',
)
const templateMensagemVencida = ref(
  '{saudacao} {cliente}, sua cobrança no valor de {valor} venceu em {vencimento}. Por favor, regularize o quanto antes. Itens: {produtos}.',
)

function parseMoedaPtBr(value: string): number {
  const numero = Number.parseFloat(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

function formatPrecoUnitario(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const valorTotal = computed(() =>
  produtos.value.reduce(
    (acc, produto) => acc + produto.quantidade * parseMoedaPtBr(produto.precoUnitario),
    0,
  ),
)

const valorTotalFormatado = computed(() =>
  valorTotal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
)

const produtosResumo = computed(() =>
  produtos.value
    .map((produto) => `${produto.quantidade}x ${produto.nome}`)
    .join(', '),
)

function avancar() {
  if (passoAtual.value < passos.length) passoAtual.value += 1
}

function voltar() {
  if (passoAtual.value > 1) passoAtual.value -= 1
}

function fechar() {
  emit('close')
}

function resetarFormulario() {
  passoAtual.value = 1
  clienteSelecionado.value = ''
  clienteNome.value = ''
  clienteTelefone.value = ''
  canalSelecionado.value = 0
  produtos.value = []
  tipoCobranca.value = 'unico'
  dataProximaLocal.value = agoraDataLocal()
  horaProximaLocal.value = agoraHoraLocal()
  ianaTimezone.value = defaultFusoDoNavegador()
  totalParcelas.value = 3
  frequenciaRecorrencia.value = 'mensal'
  frequenciaCobranca.value = 'semanal'
  dataFim.value = ''
  templateMensagem.value =
    '{saudacao} {cliente}, tudo bem? Sua cobrança no valor de {valor} vence em {vencimento}. Produtos: {produtos}.'
  templateMensagemVencida.value =
    '{saudacao} {cliente}, sua cobrança no valor de {valor} venceu em {vencimento}. Por favor, regularize o quanto antes. Itens: {produtos}.'
}

function carregarDaCobranca(cobranca: Cobranca) {
  passoAtual.value = 1
  canalSelecionado.value = cobranca.canal_id || 0
  clienteSelecionado.value = cobranca.conversa_key || ''
  clienteNome.value = cobranca.name || ''
  clienteTelefone.value = cobranca.phone || ''
  tipoCobranca.value = cobranca.tipo_cobranca
  const tzRaw = cobranca.iana_timezone?.trim() ?? ''
  ianaTimezone.value = isIanaFusoBrasilPermitido(tzRaw) ? tzRaw : defaultFusoDoNavegador()
  const partes = cobranca.data_proxima_notificacao
    ? dataHoraLocalEmFuso(cobranca.data_proxima_notificacao, ianaTimezone.value)
    : null
  dataProximaLocal.value = partes?.data || (cobranca.data_inicio || '').slice(0, 10) || agoraDataLocal()
  horaProximaLocal.value = partes?.hora || agoraHoraLocal()
  totalParcelas.value = cobranca.total_parcelas && cobranca.total_parcelas > 0 ? cobranca.total_parcelas : 3
  frequenciaRecorrencia.value = cobranca.frequencia_recorrencia || 'mensal'
  frequenciaCobranca.value = cobranca.frequencia_cobranca || 'semanal'
  dataFim.value = cobranca.data_fim ? cobranca.data_fim.slice(0, 10) : ''
  templateMensagem.value = cobranca.template_mensagem || templateMensagem.value
  templateMensagemVencida.value =
    cobranca.template_mensagem_vencida || templateMensagemVencida.value
  produtos.value = (cobranca.produtos ?? []).map((p, index) => ({
    id: Date.now() + index,
    produtoId: null,
    nome: p.produto_nome,
    unidadeVenda: '',
    quantidade: p.quantidade,
    precoUnitario: formatPrecoUnitario(p.preco_unitario),
  }))
}

function montarBody(wid: number) {
  return {
    workspace_id: wid,
    canal_id: canalSelecionado.value,
    conversa_key: clienteSelecionado.value,
    phone: clienteTelefone.value,
    name: clienteNome.value.trim() || null,
    tipo_cobranca: tipoCobranca.value,
    valor_total: Math.round(valorTotal.value * 100) / 100,
    total_parcelas:
      tipoCobranca.value === 'parcelado'
        ? totalParcelas.value
        : tipoCobranca.value === 'unico'
          ? 1
          : null,
    frequencia_recorrencia:
      tipoCobranca.value === 'assinatura' ? frequenciaRecorrencia.value : null,
    frequencia_cobranca:
      tipoCobranca.value === 'unico' ? frequenciaCobranca.value : null,
    data_proxima_local: dataProximaLocal.value,
    hora_proxima_local: horaProximaLocal.value,
    iana_timezone: ianaTimezone.value,
    data_fim: tipoCobranca.value === 'assinatura' ? dataFim.value || null : null,
    porcentagem_multa: 0,
    porcentagem_juros_mes: 0,
    template_mensagem: templateMensagem.value.trim(),
    template_mensagem_vencida: templateMensagemVencida.value.trim(),
    produtos: produtos.value.map((p) => ({
      produto_nome: p.nome,
      quantidade: p.quantidade,
      preco_unitario: parseMoedaPtBr(p.precoUnitario),
    })),
  }
}

function validarFormulario(): boolean {
  if (!clienteSelecionado.value.trim()) {
    toast.error('Selecione o cliente/conversa.')
    passoAtual.value = 1
    return false
  }
  if (!clienteTelefone.value.trim()) {
    toast.error('Telefone do cliente não encontrado.')
    passoAtual.value = 1
    return false
  }
  if (!canalSelecionado.value || canalSelecionado.value < 1) {
    toast.error('Selecione o canal de envio.')
    passoAtual.value = 1
    return false
  }
  if (produtos.value.length === 0) {
    toast.error('Adicione ao menos um produto.')
    passoAtual.value = 2
    return false
  }
  if (produtos.value.some((p) => !p.nome.trim())) {
    toast.error('Informe o nome de todos os produtos.')
    passoAtual.value = 2
    return false
  }
  if (produtos.value.some((p) => parseMoedaPtBr(p.precoUnitario) <= 0)) {
    toast.error('Informe um preço unitário válido para todos os produtos.')
    passoAtual.value = 2
    return false
  }
  if (!dataProximaLocal.value || !horaProximaLocal.value) {
    toast.error('Informe a data e o horário da próxima notificação.')
    passoAtual.value = 3
    return false
  }
  if (!isIanaFusoBrasilPermitido(ianaTimezone.value)) {
    toast.error('Selecione um fuso horário válido (Brasil).')
    passoAtual.value = 3
    return false
  }
  if (!templateMensagem.value.trim()) {
    toast.error('Informe o template da mensagem.')
    passoAtual.value = 4
    return false
  }
  if (!templateMensagemVencida.value.trim()) {
    toast.error('Informe o template da mensagem para cobrança vencida.')
    passoAtual.value = 4
    return false
  }
  return true
}

async function salvar() {
  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Workspace não identificado.')
    return
  }
  if (!validarFormulario()) return

  salvando.value = true
  try {
    if (modoEdicao.value && props.cobrancaId) {
      const resposta = await $fetch<CriarCobrancaResponse>('/api/cobranca/atualizarcobranca', {
        method: 'POST',
        body: {
          id: props.cobrancaId,
          ...montarBody(wid),
        },
      })
      cobrancaStore.updateCobranca({
        ...resposta.cobranca,
        produtos: resposta.produtos ?? resposta.cobranca.produtos,
      })
      toast.success('Cobrança atualizada com sucesso.')
      emit('updated')
      emit('close')
    } else {
      const resposta = await $fetch<CriarCobrancaResponse>('/api/cobranca/criarcobranca', {
        method: 'POST',
        body: montarBody(wid),
      })
      cobrancaStore.addCobranca(
        {
          ...resposta.cobranca,
          produtos: resposta.produtos ?? resposta.cobranca.produtos,
        },
        wid,
      )
      toast.success('Cobrança criada com sucesso.')
      resetarFormulario()
      emit('created')
      emit('close')
    }
  } catch (err) {
    toast.error(
      mensagemErroFetch(
        err,
        modoEdicao.value
          ? 'Não foi possível atualizar a cobrança.'
          : 'Não foi possível criar a cobrança.',
      ),
    )
  } finally {
    salvando.value = false
  }
}

watch(
  () => props.cobrancaId,
  (id) => {
    if (id != null && id > 0) {
      const cobranca = cobrancaStore.getById(id)
      if (cobranca) {
        carregarDaCobranca(cobranca)
        return
      }
      toast.error('Cobrança não encontrada no cache.')
      emit('close')
      return
    }
    resetarFormulario()
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="border-b border-outline/20 px-4 py-6 dark:border-dark-outline/20 sm:px-8">
      <ol class="mx-auto flex max-w-4xl items-start justify-between">
        <li
          v-for="(passo, index) in passos"
          :key="passo.id"
          class="relative flex flex-1 flex-col items-center"
        >
          <div
            v-if="index < passos.length - 1"
            class="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-px"
            :class="passoAtual > passo.id
              ? 'bg-primary dark:bg-dark-primary'
              : 'bg-outline-variant dark:bg-dark-outline-variant'"
          />
          <div
            class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full font-label text-sm font-semibold"
            :class="passoAtual >= passo.id
              ? 'bg-primary text-on-primary dark:bg-dark-primary dark:text-dark-on-primary'
              : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'"
          >
            <svg
              v-if="passoAtual > passo.id"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span v-else>{{ passo.id }}</span>
          </div>
          <span
            class="mt-2 max-w-[6rem] text-center font-label text-xs font-medium sm:text-sm"
            :class="passoAtual >= passo.id
              ? 'text-primary dark:text-dark-primary'
              : 'text-on-surface-variant dark:text-dark-on-surface-variant'"
          >
            {{ passo.label }}
          </span>
        </li>
      </ol>
    </div>

    <div class="min-h-[430px] px-4 py-6 sm:px-8 sm:py-8">
      <Cliente
        v-if="passoAtual === 1"
        v-model:cliente-selecionado="clienteSelecionado"
        v-model:canal-selecionado="canalSelecionado"
        v-model:cliente-nome="clienteNome"
        v-model:cliente-telefone="clienteTelefone"
      />

      <Produtos
        v-else-if="passoAtual === 2"
        v-model:produtos="produtos"
      />

      <Pagamento
        v-else-if="passoAtual === 3"
        v-model:tipo-cobranca="tipoCobranca"
        v-model:data-proxima-local="dataProximaLocal"
        v-model:hora-proxima-local="horaProximaLocal"
        v-model:iana-timezone="ianaTimezone"
        v-model:total-parcelas="totalParcelas"
        v-model:frequencia-recorrencia="frequenciaRecorrencia"
        v-model:frequencia-cobranca="frequenciaCobranca"
        v-model:data-fim="dataFim"
      />

      <Mensagem
        v-else
        v-model:template-mensagem="templateMensagem"
        v-model:template-mensagem-vencida="templateMensagemVencida"
      />
    </div>

    <div
      class="flex flex-col gap-3 border-t border-outline/20 px-4 py-4 dark:border-dark-outline/20 sm:flex-row sm:items-center sm:justify-between sm:px-8"
    >
      <div
        v-if="passoAtual !== 1"
        class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <span class="font-semibold text-on-surface dark:text-dark-on-surface">
          Total:
        </span>
        {{ valorTotalFormatado }}
        <span v-if="passoAtual === 4" class="ml-2 hidden sm:inline">
          · {{ clienteNome || '—' }} · {{ produtosResumo }}
        </span>
      </div>

      <div class="flex justify-end gap-3">
        <button
          v-if="passoAtual === 1"
          type="button"
          class="rounded-lg border border-primary px-5 py-2.5 font-label text-sm font-medium text-primary transition hover:bg-primary-50 dark:border-dark-primary dark:text-dark-primary dark:hover:bg-dark-primary-container/40"
          @click="fechar"
        >
          Fechar
        </button>
        <button
          v-else
          type="button"
          class="rounded-lg border border-primary px-5 py-2.5 font-label text-sm font-medium text-primary transition hover:bg-primary-50 dark:border-dark-primary dark:text-dark-primary dark:hover:bg-dark-primary-container/40"
          @click="voltar"
        >
          Voltar
        </button>
        <button
          v-if="passoAtual < passos.length"
          type="button"
          class="rounded-lg bg-primary-600 px-5 py-2.5 font-label text-sm font-medium text-on-primary shadow-sm transition hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
          @click="avancar"
        >
          Avançar
        </button>
        <button
          v-else
          type="button"
          class="rounded-lg bg-primary-600 px-5 py-2.5 font-label text-sm font-medium text-on-primary shadow-sm transition hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-700"
          :disabled="salvando"
          @click="salvar"
        >
          {{ salvando ? 'Salvando...' : (modoEdicao ? 'Salvar' : 'Criar cobrança') }}
        </button>
      </div>
    </div>
  </div>
</template>
