<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { toast } from 'vue-sonner'
import type { Canal } from '#shared/types/canal'
import type { InstanciaStatus } from '#shared/types/instanciaStatus'
import BaseAvatar from '~/components/BaseAvatar.vue'
import BaseButton from '~/components/BaseButton.vue'
import ModalQrCode from '~/components/chat/area-conversa/ModalQrCode.vue'
import ModalUrlApiKey from '~/components/workspaces/canais/ModalUrlApiKey.vue'
import ModalAtivarPagamento from '~/components/workspaces/canais/ModalAtivarPagamento.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'

type CanalStatus = 'ativo' | 'pausado'

const props = defineProps<{
  workspaceId: number
  canal: Canal
  /** Texto já formatado, ex.: "Criado em 12/10/2023" */
  dataCriacaoLabel: string
  status: CanalStatus
  /** Foto da instância (opcional) */
  avatarSrc?: string | null
}>()

const emit = defineEmits<{
  editar: [canal: Canal]
}>()

const canaisStore = useCanaisStore()
const togglePending = ref(false)
const modalIaAberto = ref(false)
const modalQrAberto = ref(false)
const statusInstancia = ref<InstanciaStatus | null>(null)
const statusPending = ref(false)
const conexaoPending = ref(false)
/** Modal aberto porque o usuário tentou ligar a I.A. sem API key. */
const modalParaAtivarIa = ref(false)
const modalPagamentoAberto = ref(false)

const canalPinia = computed(() => {
  return canaisStore.items.find((c) => c.id === props.canal.id) ?? props.canal
})

/** Só liga visualmente se existir API key E o flag no Pinia estiver true. */
const iaAtiva = computed(() => {
  const c = canalPinia.value
  return Boolean(c.tem_api_key) && Boolean(c.tem_inteligencia_artificial)
})

const conectado = computed(() => statusInstancia.value?.status === 'connected')
const badgeConexao = computed(() => (conectado.value ? 'Conectado' : 'Desconectado'))
const fotoInstancia = computed(() => statusInstancia.value?.foto?.trim() || null)

function sincronizarStatusNoPinia(status: InstanciaStatus | null) {
  if (canaisStore.currentCanalId !== props.canal.id) return
  canaisStore.instanciaStatus = status
  canaisStore.instanciaStatusCanalIdLoaded = status ? props.canal.id : null
}

async function carregarStatus() {
  statusPending.value = true
  try {
    const data = await $fetch<InstanciaStatus>('/api/canais/statusInstancia', {
      method: 'GET',
      query: { id_canal: props.canal.id },
    })
    statusInstancia.value = data
    sincronizarStatusNoPinia(data)
    return data
  } catch (err: unknown) {
    statusInstancia.value = null
    toast.error(mensagemErroFetch(err, 'Não foi possível verificar a conexão do canal.'), {
      duration: 8000,
    })
    return null
  } finally {
    statusPending.value = false
  }
}

async function desconectarCanal() {
  conexaoPending.value = true
  try {
    await $fetch('/api/canais/desconectar', {
      method: 'POST',
      body: { id_canal: props.canal.id },
    })
    const desconectado: InstanciaStatus = {
      status: 'disconnected',
      nome: null,
      foto: null,
      numero: null,
    }
    statusInstancia.value = desconectado
    sincronizarStatusNoPinia(desconectado)
    toast.success('Canal desconectado.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível desconectar a instância.'), {
      duration: 8000,
    })
  } finally {
    conexaoPending.value = false
  }
}

async function alternarConexao(e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  if (conexaoPending.value || togglePending.value || statusPending.value) return

  if (!statusInstancia.value) {
    const data = await carregarStatus()
    if (!data) return
  }

  if (conectado.value) {
    await desconectarCanal()
    return
  }
  modalQrAberto.value = true
}

onMounted(() => {
  void carregarStatus()
})

function editarCanal(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  emit('editar', canalPinia.value)
}

function abrirConfigIa(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  modalParaAtivarIa.value = false
  modalIaAberto.value = true
}

function abrirPagamento(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  modalPagamentoAberto.value = true
}

async function desativarIaSilencioso() {
  if (!canalPinia.value.tem_inteligencia_artificial) return
  try {
    await canaisStore.updateCanal({
      id_canal: props.canal.id,
      workspace_id: props.workspaceId,
      tem_inteligencia_artificial: false,
    })
  } catch {
    // UI já permanece desligada sem key; sync best-effort
  }
}

async function alternarIa(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (togglePending.value) return

  // Desligar: sempre permitido
  if (iaAtiva.value) {
    togglePending.value = true
    try {
      await canaisStore.updateCanal({
        id_canal: props.canal.id,
        workspace_id: props.workspaceId,
        tem_inteligencia_artificial: false,
      })
      toast.success('I.A. desativada neste canal.')
    } catch (err: unknown) {
      toast.error(mensagemErroFetch(err, 'Não foi possível alterar a I.A.'), {
        duration: 8000,
      })
    } finally {
      togglePending.value = false
    }
    return
  }

  // Ligar: precisa de API key
  if (canalPinia.value.tem_api_key) {
    togglePending.value = true
    try {
      await canaisStore.updateCanal({
        id_canal: props.canal.id,
        workspace_id: props.workspaceId,
        tem_inteligencia_artificial: true,
      })
      toast.success('I.A. ativada neste canal.')
    } catch (err: unknown) {
      toast.error(mensagemErroFetch(err, 'Não foi possível alterar a I.A.'), {
        duration: 8000,
      })
    } finally {
      togglePending.value = false
    }
    return
  }

  // Sem key → abre modal para cadastrar; só ativa após salvar com key
  modalParaAtivarIa.value = true
  modalIaAberto.value = true
}

function onIaSalvaComKey() {
  modalParaAtivarIa.value = false
}

watch(modalIaAberto, async (aberto, estavaAberto) => {
  if (aberto || !estavaAberto) return
  // Fechou o modal sem concluir ativação → garante I.A. desligada
  if (modalParaAtivarIa.value) {
    modalParaAtivarIa.value = false
    await desativarIaSilencioso()
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void alternarConexao()
  }
}

watch(modalQrAberto, (aberto, estavaAberto) => {
  if (aberto || !estavaAberto) return
  void carregarStatus()
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="conectado ? 'Desconectar canal' : 'Conectar canal'"
    class="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center"
    @click="alternarConexao"
    @keydown="onKeydown"
  >
    <div class="flex min-w-0 flex-1 items-start gap-4">
      <BaseAvatar
        :src="avatarSrc ?? fotoInstancia ?? null"
        :size="56"
        variant="rounded"
        class="shrink-0"
        fallback-class="bg-[#25D366] text-white shadow-sm"
      >
        <template #fallback>
          <FontAwesomeIcon :icon="faWhatsapp" class="h-8 w-8" />
        </template>
      </BaseAvatar>

      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-slate-900 dark:text-white">
          {{ canalPinia.nome ?? '' }}
        </h3>
        <p class="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {{ canalPinia.descricao ?? '' }}
        </p>
        <p
          v-if="statusInstancia?.numero || statusInstancia?.nome"
          class="mt-1 truncate text-xs text-slate-400 dark:text-slate-500"
        >
          {{ statusInstancia?.nome || 'sem nome' }}
          <span v-if="statusInstancia?.numero"> · {{ statusInstancia.numero }}</span>
        </p>
      </div>
    </div>

    <div
      class="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0 dark:border-slate-800 md:justify-end md:gap-4"
    >
      <div class="flex items-center gap-2" @click.stop>
        <button
          type="button"
          role="switch"
          :aria-checked="iaAtiva"
          :aria-label="iaAtiva ? 'Desativar I.A.' : 'Ativar I.A.'"
          title="Inteligência artificial"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          :class="iaAtiva ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'"
          :disabled="togglePending"
          @click="alternarIa"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
            :class="iaAtiva ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>

        <button
          v-if="iaAtiva"
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-violet-600 transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300 dark:hover:bg-violet-950/40"
          aria-label="Configurar API da I.A."
          title="Configurar API da I.A."
          @click="abrirConfigIa"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">settings</span>
        </button>
      </div>

      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
        aria-label="Ativar pagamento"
        title="Ativar pagamento"
        @click="abrirPagamento"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">payments</span>
      </button>

      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary"
        aria-label="Editar canal"
        title="Editar canal"
        @click="editarCanal"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
      </button>

      <div class="flex flex-col items-end gap-2" @click.stop>
        <span
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          :class="
            conectado
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          "
        >
          <span
            class="material-symbols-outlined text-[14px]"
            :class="statusPending && !statusInstancia ? 'animate-spin' : ''"
            aria-hidden="true"
          >
            {{ statusPending ? 'progress_activity' : conectado ? 'wifi' : 'wifi_off' }}
          </span>
          {{ statusPending && !statusInstancia ? 'Verificando' : badgeConexao }}
        </span>
        <BaseButton
          type="button"
          :variant="conectado ? 'secondary' : 'primary'"
          size="sm"
          :block="false"
          class="!px-3"
          :disabled="statusPending || conexaoPending"
          @click="alternarConexao"
        >
          {{ conexaoPending ? 'Aguarde…' : conectado ? 'Desconectar' : 'Conectar' }}
        </BaseButton>
      </div>

      <span
        class="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary"
      >
        <span class="size-2 animate-pulse rounded-full bg-primary" />
        {{ status === 'ativo' ? 'Ativo' : 'Pausado' }}
      </span>

      <div
        class="text-right text-[11px] leading-tight text-slate-400 tabular-nums dark:text-slate-500"
      >
        <p class="font-mono">#{{ canal.id }}</p>
        <p class="mt-1 max-w-[11rem] truncate sm:max-w-none">
          {{ dataCriacaoLabel }}
        </p>
      </div>
    </div>
  </div>

  <ModalUrlApiKey
    v-model:open="modalIaAberto"
    :workspace-id="workspaceId"
    :canal-id="canal.id"
    :ativar-ia-ao-salvar="modalParaAtivarIa"
    @salvo-com-key="onIaSalvaComKey"
  />

  <ModalAtivarPagamento
    v-model:open="modalPagamentoAberto"
    :canal-id="canal.id"
    :workspace-id="workspaceId"
  />

  <ModalQrCode
    v-model:open="modalQrAberto"
    :canal-id="canal.id"
  />
</template>
