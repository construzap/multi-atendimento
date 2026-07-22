<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseAvatar from '~/components/BaseAvatar.vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalQrCode from '~/components/chat/area-conversa/ModalQrCode.vue'
import DropdownConfig from '~/components/chat/area-conversa/DropdownConfig.vue'
import ModalAddCanal from '~/components/workspaces/canais/ModalAddCanal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'
import {
  isColunaOrigemLeadsNaoConfiguradaError,
  useConversasStore,
} from '~/stores/conversas'
import { useConversasFiltros } from '~/composables/useConversasFiltros'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'

const pesquisa = ref('')
const modalNovaConversaAberto = ref(false)
const modalColunaOrigemAberto = ref(false)
const novoTelefoneLocal = ref('')
const paisDdi = ref<'BR' | 'PT' | 'US' | 'AR' | 'CL' | 'MX'>('BR')
const criandoNovaConversa = ref(false)
const router = useRouter()

const canaisStore = useCanaisStore()
const workspacesStore = useWorkspacesStore()
const { currentCanal, instanciaStatus, items } = storeToRefs(canaisStore)
const route = useRoute()
const conversasStore = useConversasStore()
const {
  mostrarFechadas,
  mostrarGrupos,
  termoPesquisa,
} = useConversasFiltros()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

/** Prioriza `workspaces.currentWorkspaceId`; cai na rota `/workspaces/[id]/chat/...`. */
const workspaceIdNumero = computed((): number | null => {
  const fromPinia = workspacesStore.currentWorkspaceId
  if (fromPinia != null && fromPinia !== '') {
    const n = Number.parseInt(String(fromPinia), 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return workspaceId.value
})

const canalParaEdicaoModal = computed(() => currentCanal.value?.id ?? null)

async function trocarCanal(idCanal: number, close: () => void) {
  close()
  const wid = workspaceId.value
  if (!wid) {
    canaisStore.setCurrentCanalId(idCanal)
    return
  }
  await navigateTo(`/workspaces/${wid}/chat/${idCanal}`)
}

const nomeCanal = computed(() => currentCanal.value?.nome ?? '')
const canalIdLabel = computed(() => (currentCanal.value?.id ? `#${currentCanal.value.id}` : ''))
const nomeWhatsApp = computed(() => {
  const n = instanciaStatus.value?.nome?.trim()
  return n ? n : 'sem nome'
})
const numero = computed(() => {
  const n = instanciaStatus.value?.numero?.trim()
  return n ? n : 'sem numero'
})
const fotoPerfil = computed(() => instanciaStatus.value?.foto ?? null)

const isConnected = computed(() => instanciaStatus.value?.status === 'connected')
const badgeLabel = computed(() => (isConnected.value ? 'Conectado' : 'Desconectado'))

const modalQrCodeAberto = ref(false)
const modalEditarCanalAberto = ref(false)
const modalExcluirCanalAberto = ref(false)

async function alternarConexao() {
  if (!currentCanal.value?.id) return
  if (isConnected.value) {
    await canaisStore.desconectarInstancia(currentCanal.value.id).catch(() => {
      /* erro fica em canaisStore.instanciaStatusError */
    })
  } else {
    modalQrCodeAberto.value = true
  }
}

function onConfigEditar() {
  if (!canalParaEdicaoModal.value || workspaceIdNumero.value == null) {
    toast.warning('Não foi possível identificar o canal ou o workspace.')
    return
  }
  modalEditarCanalAberto.value = true
}

async function onConfigExcluir() {
  const id = currentCanal.value?.id
  const wid = workspaceIdNumero.value
  if (!id || wid == null) {
    toast.warning('Não foi possível identificar o canal ou o workspace.')
    return
  }
  modalExcluirCanalAberto.value = true
}

async function confirmarExclusaoCanal() {
  const id = currentCanal.value?.id
  const wid = workspaceIdNumero.value
  if (!id || wid == null) {
    modalExcluirCanalAberto.value = false
    return
  }
  try {
    await canaisStore.deleteCanal(id, wid)
    modalExcluirCanalAberto.value = false
    toast.success('Canal deletado com sucesso.')
    await navigateTo(`/workspaces/${wid}/canais`)
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível excluir o canal.')
    toast.error(msg, { duration: 8000 })
  }
}

function currentDdiDigits(): string {
  return paisDdi.value === 'BR'
    ? '55'
    : paisDdi.value === 'PT'
      ? '351'
      : paisDdi.value === 'US'
        ? '1'
        : paisDdi.value === 'AR'
          ? '54'
          : paisDdi.value === 'CL'
            ? '56'
            : '52' // MX
}

function validateAndNormalizeTelefone(localRaw: string): string | null {
  const local = String(localRaw ?? '').replace(/\D/g, '')
  if (!local) return null

  const ddi = currentDdiDigits()

  // Para BR, pedimos DDD(2) + (9?) + número(8) => 10 ou 11 (sem o 55)
  if (ddi === '55') {
    if (local.length !== 10 && local.length !== 11) return null
  } else {
    // Regra mínima genérica para evitar números curtos demais
    if (local.length < 8) return null
  }

  const digits = `${ddi}${local}`
  return normalizeWhatsappBr(digits)
}

const caminhoConfiguracoes = computed(() => {
  const wid = workspaceIdNumero.value
  return wid != null ? `/workspaces/${wid}/configuracoes` : '/workspaces'
})

function irParaConfiguracoesColunaOrigem() {
  modalColunaOrigemAberto.value = false
  modalNovaConversaAberto.value = false
  void router.push(caminhoConfiguracoes.value)
}

async function criarNovaConversa() {
  const canalId = currentCanal.value?.id
  if (!canalId) {
    toast.warning('Selecione um canal antes de iniciar uma nova conversa.')
    return
  }

  const normalized = validateAndNormalizeTelefone(novoTelefoneLocal.value)
  if (!normalized) {
    toast.warning('Digite um número válido (DDD+número).')
    return
  }

  criandoNovaConversa.value = true
  try {
    await conversasStore.ensureConversaByPhone({ id_canal: canalId, phone: normalized })
    modalNovaConversaAberto.value = false
    novoTelefoneLocal.value = ''
  } catch (err: unknown) {
    if (isColunaOrigemLeadsNaoConfiguradaError(err)) {
      modalColunaOrigemAberto.value = true
      return
    }
    const msg = mensagemErroFetch(err, 'Não foi possível criar/abrir a conversa.')
    toast.error(msg, { duration: 8000 })
  } finally {
    criandoNovaConversa.value = false
  }
}

const alternandoFechadas = ref(false)
const alternandoGrupos = ref(false)
const atualizandoLista = ref(false)

const labelToggleFechadas = computed(() =>
  mostrarFechadas.value ? 'Somente abertas' : 'Mostrar fechadas'
)

const iconeToggleFechadas = computed(() =>
  mostrarFechadas.value ? 'visibility_off' : 'visibility'
)

const labelToggleGrupos = computed(() =>
  mostrarGrupos.value ? 'Ocultar grupos' : 'Mostrar grupos'
)

const iconeToggleGrupos = computed(() =>
  mostrarGrupos.value ? 'group_off' : 'groups'
)

const DEBOUNCE_BUSCA_MS = 400
let buscaTimer: ReturnType<typeof setTimeout> | null = null

function agendarPesquisa() {
  if (buscaTimer) clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => {
    buscaTimer = null
    void executarPesquisa()
  }, DEBOUNCE_BUSCA_MS)
}

async function executarPesquisa() {
  if (buscaTimer) {
    clearTimeout(buscaTimer)
    buscaTimer = null
  }
  const termo = pesquisa.value.trim()
  if (termo === termoPesquisa.value.trim()) return
  try {
    await conversasStore.aplicarPesquisa(pesquisa.value)
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível buscar conversas.')
    toast.error(msg, { duration: 8000 })
  }
}

watch(
  () => currentCanal.value?.id,
  () => {
    pesquisa.value = termoPesquisa.value
  },
)

watch(termoPesquisa, (t) => {
  if (pesquisa.value !== t) pesquisa.value = t
})

watch(pesquisa, (valor, anterior) => {
  if (valor === anterior) return
  // Sync externo do Pinia → não dispara nova busca.
  if (valor === termoPesquisa.value) return
  agendarPesquisa()
})

onBeforeUnmount(() => {
  if (buscaTimer) {
    clearTimeout(buscaTimer)
    buscaTimer = null
  }
})

async function alternarMostrarConversasFechadas() {
  if (alternandoFechadas.value || !currentCanal.value?.id) return
  alternandoFechadas.value = true
  try {
    await conversasStore.setMostrarFechadas(!mostrarFechadas.value)
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível atualizar a lista de conversas.')
    toast.error(msg, { duration: 8000 })
  } finally {
    alternandoFechadas.value = false
  }
}

async function alternarMostrarGrupos() {
  if (alternandoGrupos.value || !currentCanal.value?.id) return
  alternandoGrupos.value = true
  try {
    await conversasStore.setMostrarGrupos(!mostrarGrupos.value)
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível atualizar a lista de conversas.')
    toast.error(msg, { duration: 8000 })
  } finally {
    alternandoGrupos.value = false
  }
}

async function atualizarListaConversas() {
  if (atualizandoLista.value || !currentCanal.value?.id) return
  atualizandoLista.value = true
  try {
    await conversasStore.atualizarLista()
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível atualizar a lista de conversas.')
    toast.error(msg, { duration: 8000 })
  } finally {
    atualizandoLista.value = false
  }
}
</script>

<template>
  <div class="shrink-0 border-b border-slate-200/80 bg-white/80 dark:border-slate-700/80 dark:bg-slate-900/40">
    <ModalQrCode
      v-model:open="modalQrCodeAberto"
      :canal-id="currentCanal?.id ?? null"
    />

    <ModalAddCanal
      v-if="workspaceIdNumero != null"
      v-model:open="modalEditarCanalAberto"
      mode="edit"
      :workspace-id="workspaceIdNumero"
      :canal-edicao-id="canalParaEdicaoModal"
    />

    <ModalAlerta
      v-model:open="modalExcluirCanalAberto"
      title="Excluir canal"
      texto="Tem certeza que deseja excluir este canal? A instância no WhatsApp será removida e esta ação não pode ser desfeita."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="canaisStore.pending"
      :cancelar-desabilitado="canaisStore.pending"
      :mostrar-fechar="!canaisStore.pending"
      @confirmar="confirmarExclusaoCanal"
    />

    <!-- Linha 1: nome do canal + configurações (tema só no botão flutuante global) -->
    <div class="flex items-start justify-between gap-3 px-4 pb-3 pt-4 pl-16 md:pl-4">
      <h2
        class="min-w-0 flex-1 truncate font-headline text-lg font-bold leading-tight text-slate-900 dark:text-slate-100"
        :title="nomeCanal"
      >
        <span class="truncate">{{ nomeCanal }}</span>
        <span v-if="canalIdLabel" class="ml-2 shrink-0 text-xs font-mono text-slate-500 dark:text-slate-400">
          {{ canalIdLabel }}
        </span>
      </h2>
      <div class="flex shrink-0 items-center gap-1.5">
        <BaseDropdown
          title="Trocar canal"
          align="left"
          panel-class="w-64 min-w-[14rem] max-w-[calc(100vw-2rem)]"
        >
          <template #trigger>
            <span class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
              <span
                class="material-symbols-outlined text-[22px] text-on-surface-variant dark:text-slate-400"
                aria-hidden="true"
              >
                swap_horiz
              </span>
              <span class="sr-only">Trocar canal</span>
            </span>
          </template>

          <template #default="{ close }">
            <div class="max-h-72 overflow-y-auto">
              <button
                v-for="c in items"
                :key="c.id"
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                @click="trocarCanal(c.id, close)"
              >
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="
                    currentCanal?.id === c.id
                      ? 'bg-emerald-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                  "
                  aria-hidden="true"
                />
                <span class="min-w-0">
                  <span class="block truncate">{{ c.nome ?? 'Canal sem nome' }}</span>
                  <span
                    class="block truncate font-mono text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    #{{ c.id }}
                  </span>
                </span>
              </button>
            </div>
          </template>
        </BaseDropdown>

        <DropdownConfig class="shrink-0" @editar="onConfigEditar" @excluir="onConfigExcluir" />
      </div>
    </div>

    <!-- Linha 2: avatar, nome WhatsApp, telefone; à direita badge + ação -->
    <div class="flex items-center gap-3 px-4 pb-4">
      <div class="relative shrink-0">
        <BaseAvatar
          :src="fotoPerfil ?? null"
          :alt="nomeWhatsApp || 'WhatsApp'"
          text="EU"
          :size="48"
          variant="circle"
          class="border-2 border-primary-container"
        />
        <span
          class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-900"
          aria-hidden="true"
        />
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate font-headline font-semibold text-slate-900 dark:text-slate-100">
          {{ nomeWhatsApp }}
        </p>
        <p class="mt-0.5 text-xs text-on-surface-variant dark:text-slate-400">
          {{ numero }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-2">
        <span
          class="inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          :class="
            isConnected
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          "
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">
            {{ isConnected ? 'wifi' : 'wifi_off' }}
          </span>
          {{ badgeLabel }}
        </span>
        <BaseButton
          type="button"
          :variant="isConnected ? 'secondary' : 'primary'"
          size="sm"
          :block="false"
          class="!px-3"
          @click="alternarConexao"
        >
          {{ isConnected ? 'Desconectar' : 'Conectar' }}
        </BaseButton>
      </div>
    </div>

    <div class="border-t border-slate-100 px-4 pb-3 pt-2 dark:border-slate-800">
      <form class="w-full" @submit.prevent="executarPesquisa">
        <BaseInput
          id="conversas-pesquisa"
          v-model="pesquisa"
          type="search"
          name="pesquisa-conversas"
          placeholder="Buscar conversas…"
          autocomplete="off"
          wrapper-id="conversas-pesquisa-wrap"
          class="w-full"
        >
          <template #leading>
            <svg
              class="h-5 w-5 text-gray-400 dark:text-dark-on-surface-variant/70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" stroke-linecap="round" />
            </svg>
          </template>
        </BaseInput>
      </form>

      <div class="mt-2 grid w-full grid-cols-2 gap-2">
        <BaseButton
          type="button"
          variant="primary"
          size="sm"
          :block="false"
          class="!flex min-h-9 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap !px-2 !py-0 text-[11px] leading-tight"
          @click="modalNovaConversaAberto = true"
        >
          <span class="material-symbols-outlined shrink-0 text-[14px]" aria-hidden="true">chat_add_on</span>
          <span class="truncate">Nova conversa</span>
        </BaseButton>

        <BaseButton
          type="button"
          :variant="mostrarFechadas ? 'primary' : 'secondary'"
          size="sm"
          :block="false"
          class="!flex min-h-9 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap !px-2 !py-0 text-[11px] leading-tight"
          :loading="alternandoFechadas"
          :disabled="alternandoFechadas || !currentCanal?.id"
          :aria-pressed="mostrarFechadas"
          :aria-label="labelToggleFechadas"
          @click="alternarMostrarConversasFechadas"
        >
          <span class="material-symbols-outlined shrink-0 text-[14px]" aria-hidden="true">{{ iconeToggleFechadas }}</span>
          <span class="truncate">{{ labelToggleFechadas }}</span>
        </BaseButton>

        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          class="!flex min-h-9 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap !px-2 !py-0 text-[11px] leading-tight"
          :loading="atualizandoLista"
          :disabled="atualizandoLista || !currentCanal?.id"
          aria-label="Atualizar lista de conversas"
          @click="atualizarListaConversas"
        >
          <span class="material-symbols-outlined shrink-0 text-[14px]" aria-hidden="true">refresh</span>
          <span class="truncate">Atualizar</span>
        </BaseButton>

        <BaseButton
          type="button"
          :variant="mostrarGrupos ? 'primary' : 'secondary'"
          size="sm"
          :block="false"
          class="!flex min-h-9 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap !px-2 !py-0 text-[11px] leading-tight"
          :loading="alternandoGrupos"
          :disabled="alternandoGrupos || !currentCanal?.id"
          :aria-pressed="mostrarGrupos"
          :aria-label="labelToggleGrupos"
          @click="alternarMostrarGrupos"
        >
          <span class="material-symbols-outlined shrink-0 text-[14px]" aria-hidden="true">{{ iconeToggleGrupos }}</span>
          <span class="truncate">{{ labelToggleGrupos }}</span>
        </BaseButton>
      </div>
    </div>

    <BaseModal
      v-model:open="modalNovaConversaAberto"
      title="Nova conversa"
      :show-close="!criandoNovaConversa"
      panel-class="w-full max-w-md"
    >
      <template #subtitle>
        Selecione o país (DDI) e digite DDD+número.
      </template>

      <div class="space-y-3">
        <div class="flex items-stretch gap-2">
          <label class="sr-only" for="nova-conversa-ddi">País / DDI</label>
          <select
            id="nova-conversa-ddi"
            v-model="paisDdi"
            class="h-[52px] w-[9.5rem] rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="criandoNovaConversa"
          >
            <option value="BR">Brasil (+55)</option>
            <option value="PT">Portugal (+351)</option>
            <option value="US">EUA (+1)</option>
            <option value="AR">Argentina (+54)</option>
            <option value="CL">Chile (+56)</option>
            <option value="MX">México (+52)</option>
          </select>

          <BaseInput
            id="nova-conversa-telefone"
            v-model="novoTelefoneLocal"
            type="tel"
            name="nova-conversa-telefone"
            placeholder="DDD + número"
            autocomplete="off"
            class="flex-1"
          />
        </div>
        <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Para Brasil, vamos normalizar automaticamente o “9º dígito” quando aplicável.
        </p>
      </div>

      <template #footer>
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          :disabled="criandoNovaConversa"
          @click="modalNovaConversaAberto = false"
        >
          Cancelar
        </BaseButton>
        <BaseButton
          type="button"
          variant="primary"
          size="sm"
          :block="false"
          :loading="criandoNovaConversa"
          :disabled="criandoNovaConversa"
          @click="criarNovaConversa"
        >
          Abrir conversa
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      v-model:open="modalColunaOrigemAberto"
      title="Coluna origem dos leads"
      panel-class="w-full max-w-md"
    >
      <template #icon>
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">settings</span>
      </template>
      <template #subtitle>
        Configuração necessária para criar conversas.
      </template>

      <p class="text-sm text-on-surface dark:text-dark-on-surface">
        É preciso definir a
        <strong>Coluna origem dos leads</strong>
        nas configurações do workspace antes de criar uma nova conversa.
      </p>
      <p class="mt-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Caminho:
        <span class="font-mono text-xs">{{ caminhoConfiguracoes }}</span>
      </p>

      <template #footer>
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          @click="modalColunaOrigemAberto = false"
        >
          Fechar
        </BaseButton>
        <BaseButton
          type="button"
          variant="primary"
          size="sm"
          :block="false"
          @click="irParaConfiguracoesColunaOrigem"
        >
          Ir para configurações
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
