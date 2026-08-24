<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import AdminAcessoNegado from '~/components/admin/pagina_inicial/AdminAcessoNegado.vue'
import LogsWebhookDetalheModal from '~/components/logs/LogsWebhookDetalheModal.vue'
import LogsWebhookFiltros from '~/components/logs/LogsWebhookFiltros.vue'
import LogsWebhookHeader from '~/components/logs/LogsWebhookHeader.vue'
import LogsWebhookLista from '~/components/logs/LogsWebhookLista.vue'
import type { WebhookExecucaoStatus } from '#shared/types/webhookExecucao'
import { useProfileStore } from '~/stores/profile'
import { useWebhookLogsStore } from '~/stores/webhookLogs'

definePageMeta({
  layout: 'workspace',
})

const profile = useProfileStore()

try {
  await profile.ensureAdminVerificado()
} catch {
  /* erro em profile.adminError */
}

const isAdmin = computed(() => profile.isAdminConfirmado)
const verificarPending = computed(() => profile.adminPending)
const verificarErroTexto = computed(() => profile.adminError)
const route = useRoute()
const webhookLogs = useWebhookLogsStore()
const { execucoes, pending, error, total, filtroStatus, filtroDe, filtroAte } = storeToRefs(webhookLogs)

const filtroDeLocal = ref('')
const filtroAteLocal = ref('')

const periodoAtivo = computed(() => Boolean(filtroDe.value || filtroAte.value))

const modalAberto = ref(false)
const execucaoSelecionadaId = ref<string | null>(null)

const workspaceId = computed(() => {
  const raw = route.params.id
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
})

const execucaoSelecionada = computed(() => {
  const id = execucaoSelecionadaId.value
  if (!id) return null
  return webhookLogs.execucaoDetalhe(id)
})

const detalheCarregando = computed(() => {
  const id = execucaoSelecionadaId.value
  if (!id) return false
  return webhookLogs.detalheCarregando(id)
})

const statusFiltro = computed({
  get: () => filtroStatus.value,
  set: (v: WebhookExecucaoStatus | 'todos') => {
    void onMudarFiltro(v)
  },
})

watch(
  [workspaceId, isAdmin],
  async ([id, admin], [prevId]) => {
    if (!id || !admin) return
    if (prevId != null && prevId !== id) {
      webhookLogs.invalidar()
      filtroDeLocal.value = ''
      filtroAteLocal.value = ''
    }
    filtroDeLocal.value = filtroDe.value ?? ''
    filtroAteLocal.value = filtroAte.value ?? ''
    try {
      await webhookLogs.fetchExecucoes(id)
    } catch {
      if (webhookLogs.error) toast.error(webhookLogs.error)
    }
  },
  { immediate: true },
)
watch([filtroDe, filtroAte], ([de, ate]) => {
  filtroDeLocal.value = de ?? ''
  filtroAteLocal.value = ate ?? ''
})

async function onMudarFiltro(status: WebhookExecucaoStatus | 'todos') {
  const id = workspaceId.value
  if (!id) return
  try {
    await webhookLogs.setFiltroStatus(status, id)
  } catch {
    if (webhookLogs.error) toast.error(webhookLogs.error)
  }
}

async function verDetalhe(id: string) {
  const wsId = workspaceId.value
  if (!wsId) return

  execucaoSelecionadaId.value = id
  modalAberto.value = true

  try {
    await webhookLogs.fetchDetalhe(wsId, id)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Não foi possível carregar o detalhe.')
    modalAberto.value = false
    execucaoSelecionadaId.value = null
  }
}

async function onAtualizar() {
  const id = workspaceId.value
  if (!id) return
  try {
    await webhookLogs.fetchExecucoes(id, { force: true })
    toast.success('Logs atualizados.')
  } catch {
    if (webhookLogs.error) toast.error(webhookLogs.error)
  }
}

async function onAplicarPeriodo() {
  const id = workspaceId.value
  if (!id) return
  if (!filtroDeLocal.value.trim() && !filtroAteLocal.value.trim()) {
    toast.error('Informe ao menos uma data/hora (de ou até).')
    return
  }
  if (filtroDeLocal.value.trim() && filtroAteLocal.value.trim()) {
    const de = new Date(filtroDeLocal.value).getTime()
    const ate = new Date(filtroAteLocal.value).getTime()
    if (!Number.isNaN(de) && !Number.isNaN(ate) && de > ate) {
      toast.error('A data "De" deve ser anterior ou igual à data "Até".')
      return
    }
  }
  try {
    await webhookLogs.setFiltroPeriodo(
      filtroDeLocal.value.trim() || null,
      filtroAteLocal.value.trim() || null,
      id,
    )
  } catch {
    if (webhookLogs.error) toast.error(webhookLogs.error)
  }
}

async function onLimparPeriodo() {
  const id = workspaceId.value
  if (!id) return
  filtroDeLocal.value = ''
  filtroAteLocal.value = ''
  try {
    await webhookLogs.limparFiltroPeriodo(id)
  } catch {
    if (webhookLogs.error) toast.error(webhookLogs.error)
  }
}
</script>

<template>
  <AdminAcessoNegado v-if="!verificarPending && !verificarErroTexto && !isAdmin" />

  <div
    v-else-if="verificarPending"
    class="flex min-h-[50dvh] items-center justify-center p-6 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
  >
    Verificando permissões...
  </div>

  <div
    v-else-if="verificarErroTexto"
    class="mx-auto max-w-lg px-4 py-16 text-center"
  >
    <p class="text-sm text-danger dark:text-dark-danger">
      {{ verificarErroTexto }}
    </p>
  </div>

  <div v-else class="relative min-h-[100dvh] w-full p-4 md:p-6 bg-white dark:bg-dark-background">

    <div class="mx-auto max-w-3xl space-y-6">
      <LogsWebhookHeader :total="total" :carregando="pending" />

      <p v-if="error && !pending" class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </p>

      <LogsWebhookFiltros
        v-model:status-filtro="statusFiltro"
        v-model:filtro-de="filtroDeLocal"
        v-model:filtro-ate="filtroAteLocal"
        :atualizando="pending"
        :periodo-ativo="periodoAtivo"
        @atualizar="onAtualizar"
        @aplicar-periodo="onAplicarPeriodo"
        @limpar-periodo="onLimparPeriodo"
      />

      <LogsWebhookLista
        :execucoes="execucoes"
        :carregando="pending"
        @ver-detalhe="verDetalhe"
      />
    </div>

    <LogsWebhookDetalheModal
      v-model:open="modalAberto"
      :execucao="execucaoSelecionada"
      :carregando="detalheCarregando"
    />
  </div>
</template>