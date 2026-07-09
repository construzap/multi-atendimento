<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalCriarCampoPersonalizado from '~/components/chat/area-info-conversa/ModalCriarCampoPersonalizado.vue'
import type { CampoPersonalizado, TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import type { Conversa, ConversaCampoPersonalizado } from '#shared/types/conversa'
import { useCamposPersonalizadosStore } from '~/stores/camposPersonalizados'
import { useKanbanStore } from '~/stores/kanban'

const TIPO_LABEL: Record<TipoCampoPersonalizado, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Sim/Não',
}

const TIPOS_FORMULARIO = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

const INPUT_CLASS =
  '!rounded-lg !border-outline/30 !bg-white !py-2 text-sm dark:!border-dark-outline/30 dark:!bg-dark-surface-container-low'

const SELECT_CLASS =
  'w-full rounded-lg border border-outline/30 bg-white px-3 py-2 text-sm text-on-surface shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface'

const route = useRoute()
const conversasStore = useConversasStore()
const workspacesStore = useWorkspacesStore()
const camposStore = useCamposPersonalizadosStore()
const kanbanStore = useKanbanStore()
const { camposPending } = storeToRefs(camposStore)

const carregandoValores = ref(false)
const modalGestaoAberto = ref(false)
const modalFormCampoAberto = ref(false)
const campoDefinicaoEmEdicao = ref<CampoPersonalizado | null>(null)
const modalExcluirCampo = ref(false)
const campoParaExcluir = ref<CampoPersonalizado | null>(null)
const excluindoCampo = ref(false)

const valorCampoIdEmEdicao = ref<number | null>(null)
const draftValor = ref('')
const salvandoValorId = ref<number | null>(null)

function parseWorkspaceId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

const workspaceId = computed(() => {
  const fromStore = parseWorkspaceId(workspacesStore.currentWorkspaceId)
  if (fromStore) return fromStore
  return parseWorkspaceId(route.params.id)
})

const conversa = computed<Conversa | null>(() => {
  const key = conversasStore.conversaAtual?.trim()
  if (!key) return null
  return conversasStore.findConversaByKey(key) ?? conversasStore.items.find((c) => c.key === key) ?? null
})

const valoresPending = computed(() => {
  const wsId = workspaceId.value
  const key = conversa.value?.key
  if (!wsId || !key) return false
  return Boolean(camposStore.valoresPending[`${wsId}:${key}`])
})

const carregando = computed(
  () =>
    carregandoValores.value ||
    (camposPending.value && !camposStore.temCamposCarregados(workspaceId.value ?? 0)) ||
    valoresPending.value,
)

const campos = computed<ConversaCampoPersonalizado[]>(() => conversa.value?.campos_personalizados ?? [])

const camposExibicao = computed(() => campos.value.filter((c) => TIPOS_FORMULARIO.has(c.tipo)))

const camposCarregados = computed(() => conversa.value?.campos_personalizados !== undefined)

const podeGerenciarCampos = computed(() => workspaceId.value != null)

const camposDefinicao = computed<CampoPersonalizado[]>(() => {
  const wsId = workspaceId.value
  if (!wsId) return []
  return camposStore.camposPorWorkspace[wsId] ?? []
})

const campoParaModal = computed(() => {
  const campo = campoDefinicaoEmEdicao.value
  if (!campo) return null
  return { id: campo.id, nome: campo.nome, tipo: campo.tipo }
})

const textoConfirmarExclusaoCampo = computed(() => {
  const nome = campoParaExcluir.value?.nome?.trim()
  if (!nome) {
    return 'Deseja excluir este campo personalizado? Os valores salvos nas conversas também serão removidos.'
  }
  return `Deseja excluir o campo "${nome}"? Os valores salvos nas conversas também serão removidos.`
})

function labelTipo(tipo: TipoCampoPersonalizado): string {
  return TIPO_LABEL[tipo] ?? tipo
}

function formatValor(campo: ConversaCampoPersonalizado): string {
  const raw = campo.valor
  if (raw == null || raw === '') return '—'
  if (campo.tipo === 'boolean') {
    if (raw === 'true') return 'Sim'
    if (raw === 'false') return 'Não'
    return '—'
  }
  return raw
}

function valorParaDraft(tipo: TipoCampoPersonalizado, stored: string | null): string {
  if (tipo === 'boolean') {
    if (stored === 'true') return 'true'
    if (stored === 'false') return 'false'
    return ''
  }
  return stored ?? ''
}

function draftParaPayload(tipo: TipoCampoPersonalizado, draft: string): unknown {
  if (tipo === 'boolean') {
    if (draft === '') return null
    return draft === 'true'
  }
  if (tipo === 'number') {
    if (draft.trim() === '') return null
    return draft
  }
  if (tipo === 'date') {
    if (draft.trim() === '') return null
    return draft.trim()
  }
  if (draft.trim() === '') return null
  return draft.trim()
}

function espelharCampoNoKanban(campo: ConversaCampoPersonalizado) {
  const wsId = workspaceId.value
  const key = conversa.value?.key?.trim()
  if (!wsId || !key || kanbanStore.loadedAt == null || kanbanStore.workspaceIdLoaded !== wsId) return

  kanbanStore.atualizarCampoPersonalizadoNoCard(key, {
    id: campo.id,
    nome: campo.nome,
    tipo: campo.tipo,
    valor: campo.valor,
  })
}

function cancelarEdicaoValor() {
  valorCampoIdEmEdicao.value = null
  draftValor.value = ''
}

function iniciarEdicaoValor(campo: ConversaCampoPersonalizado) {
  valorCampoIdEmEdicao.value = campo.id
  draftValor.value = valorParaDraft(campo.tipo, campo.valor)
}

async function salvarValorCampo(campo: ConversaCampoPersonalizado) {
  const wsId = workspaceId.value
  const key = conversa.value?.key?.trim()
  if (!wsId || !key || salvandoValorId.value != null) return

  salvandoValorId.value = campo.id
  try {
    const salvo = await camposStore.salvarValor(
      wsId,
      key,
      campo.id,
      draftParaPayload(campo.tipo, draftValor.value),
    )

    conversasStore.atualizarValorCampoPersonalizadoNasConversas(key, campo.id, salvo.valor)
    espelharCampoNoKanban({ ...campo, valor: salvo.valor })
    toast.success('Valor salvo.')
    cancelarEdicaoValor()
  } catch {
    toast.error(camposStore.error ?? 'Não foi possível salvar o valor.', { duration: 8000 })
  } finally {
    salvandoValorId.value = null
  }
}

async function garantirCamposCarregados() {
  if (!import.meta.client) return

  const wsId = workspaceId.value
  const key = conversa.value?.key?.trim()
  if (!wsId || !key || key.startsWith('temp:')) return
  if (conversa.value?.campos_personalizados !== undefined) return

  carregandoValores.value = true
  try {
    await conversasStore.ensureCamposPersonalizadosNaConversa(wsId, key)
  } finally {
    carregandoValores.value = false
  }
}

async function abrirModalGestao() {
  const wsId = workspaceId.value
  if (!wsId) return

  modalGestaoAberto.value = true
  try {
    await camposStore.fetchCampos(wsId)
  } catch {
    // erro em camposStore.error
  }
}

function abrirModalCriar() {
  if (!podeGerenciarCampos.value) return
  campoDefinicaoEmEdicao.value = null
  modalFormCampoAberto.value = true
}

function abrirModalEditar(campo: CampoPersonalizado) {
  if (!podeGerenciarCampos.value) return
  campoDefinicaoEmEdicao.value = campo
  modalFormCampoAberto.value = true
}

function onCampoSalvo(campo: CampoPersonalizado) {
  const existente = campoDefinicaoEmEdicao.value
  const valorExistente =
    existente
      ? conversa.value?.campos_personalizados?.find((c) => c.id === campo.id)?.valor ?? null
      : null

  if (existente) {
    conversasStore.atualizarCampoPersonalizadoNasConversas(campo)
    espelharCampoNoKanban({
      id: campo.id,
      nome: campo.nome,
      tipo: campo.tipo,
      valor: valorExistente,
    })
  } else {
    conversasStore.adicionarCampoPersonalizadoNasConversas(campo)
    espelharCampoNoKanban({
      id: campo.id,
      nome: campo.nome,
      tipo: campo.tipo,
      valor: null,
    })
  }

  campoDefinicaoEmEdicao.value = null
}

function solicitarExcluirCampo(campo: CampoPersonalizado) {
  campoParaExcluir.value = campo
  modalExcluirCampo.value = true
}

async function confirmarExcluirCampo() {
  const campo = campoParaExcluir.value
  const wsId = workspaceId.value
  const key = conversa.value?.key?.trim()
  if (!campo || wsId == null) return

  excluindoCampo.value = true
  try {
    await camposStore.excluirCampo(wsId, campo.id)
    conversasStore.removerCampoPersonalizadoDasConversas(campo.id)
    if (valorCampoIdEmEdicao.value === campo.id) cancelarEdicaoValor()
    if (key && kanbanStore.loadedAt != null && kanbanStore.workspaceIdLoaded === wsId) {
      kanbanStore.removerCampoPersonalizadoDoCard(key, campo.id)
    }
    toast.success('Campo personalizado excluído.')
    modalExcluirCampo.value = false
    campoParaExcluir.value = null
  } catch {
    toast.error(camposStore.error ?? 'Não foi possível excluir o campo.', { duration: 8000 })
  } finally {
    excluindoCampo.value = false
  }
}

watch(
  [conversa, workspaceId],
  () => {
    cancelarEdicaoValor()
    void garantirCamposCarregados()
  },
  { immediate: true },
)

watch(modalFormCampoAberto, (aberto) => {
  if (!aberto) campoDefinicaoEmEdicao.value = null
})

watch(modalExcluirCampo, (aberto) => {
  if (!aberto && !excluindoCampo.value) campoParaExcluir.value = null
})
</script>

<template>
  <section v-if="conversa" class="border-b border-outline-variant/10 px-6 pb-6 pt-4">
    <div class="mb-3 flex items-center justify-between gap-2">
      <h3 class="font-headline text-sm font-bold text-slate-900 dark:text-slate-100">
        Campos personalizados
      </h3>
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary"
        aria-label="Gerenciar campos personalizados"
        :disabled="!podeGerenciarCampos"
        @click="abrirModalGestao"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
      </button>
    </div>

    <div
      v-if="carregando && !camposCarregados"
      class="rounded-2xl border border-outline/30 bg-surface-container-low p-4 text-sm italic text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40 dark:text-dark-on-surface-variant"
    >
      Carregando campos…
    </div>

    <p
      v-else-if="camposCarregados && !camposExibicao.length"
      class="rounded-2xl border border-dashed border-outline/30 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40 dark:text-dark-on-surface-variant"
    >
      Nenhum campo personalizado neste workspace.
    </p>

    <dl
      v-else-if="camposExibicao.length"
      class="space-y-3 rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40"
    >
      <div
        v-for="campo in camposExibicao"
        :key="campo.id"
        class="group"
      >
        <!-- Visualização limpa -->
        <div v-if="valorCampoIdEmEdicao !== campo.id" class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ campo.nome }}
            </dt>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-all hover:bg-surface-container-high hover:text-primary group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
              aria-label="Editar valor"
              @click="iniciarEdicaoValor(campo)"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
            </button>
          </div>
          <dd class="text-sm text-on-surface dark:text-dark-on-surface">
            {{ formatValor(campo) }}
          </dd>
        </div>

        <!-- Edição inline -->
        <div v-else class="space-y-2 rounded-xl border border-primary/20 bg-white/80 p-3 dark:border-primary/30 dark:bg-dark-surface-container-low/80">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ campo.nome }}
          </p>

          <BaseInput
            v-if="campo.tipo === 'text'"
            :id="`info-campo-valor-${campo.id}`"
            v-model="draftValor"
            type="text"
            placeholder="Digite o valor…"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            :disabled="salvandoValorId === campo.id"
          />

          <BaseInput
            v-else-if="campo.tipo === 'number'"
            :id="`info-campo-valor-${campo.id}`"
            v-model="draftValor"
            type="number"
            inputmode="decimal"
            placeholder="0"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            :disabled="salvandoValorId === campo.id"
          />

          <BaseInput
            v-else-if="campo.tipo === 'date'"
            :id="`info-campo-valor-${campo.id}`"
            v-model="draftValor"
            type="date"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            :disabled="salvandoValorId === campo.id"
          />

          <select
            v-else-if="campo.tipo === 'boolean'"
            :id="`info-campo-valor-${campo.id}`"
            v-model="draftValor"
            :class="SELECT_CLASS"
            :disabled="salvandoValorId === campo.id"
          >
            <option value="">Selecione…</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>

          <div class="flex justify-end gap-2">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              :disabled="salvandoValorId === campo.id"
              @click="cancelarEdicaoValor"
            >
              Cancelar
            </BaseButton>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :loading="salvandoValorId === campo.id"
              :disabled="salvandoValorId === campo.id"
              @click="salvarValorCampo(campo)"
            >
              Salvar
            </BaseButton>
          </div>
        </div>
      </div>
    </dl>

    <BaseModal
      v-model:open="modalGestaoAberto"
      title="Gerenciar campos personalizados"
      panel-class="w-full max-w-lg"
    >
      <template #icon>
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">tune</span>
      </template>

      <template #subtitle>
        Crie, edite ou exclua os campos disponíveis neste workspace.
      </template>

      <div v-if="camposPending && !camposDefinicao.length" class="text-sm italic text-on-surface-variant dark:text-dark-on-surface-variant">
        Carregando campos…
      </div>

      <p
        v-else-if="!camposDefinicao.length"
        class="rounded-xl border border-dashed border-outline/30 px-4 py-6 text-center text-sm text-on-surface-variant dark:border-dark-outline/30 dark:text-dark-on-surface-variant"
      >
        Nenhum campo personalizado cadastrado.
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="campo in camposDefinicao"
          :key="campo.id"
          class="flex items-center justify-between gap-3 rounded-xl border border-outline/30 bg-white px-3 py-2.5 dark:border-dark-outline/30 dark:bg-dark-surface-container-low"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-on-surface dark:text-dark-on-surface">
              {{ campo.nome }}
            </p>
            <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ labelTipo(campo.tipo) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-container-high hover:text-primary dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
              aria-label="Editar campo"
              @click="abrirModalEditar(campo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              aria-label="Excluir campo"
              :disabled="excluindoCampo"
              @click="solicitarExcluirCampo(campo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
            </button>
          </div>
        </li>
      </ul>

      <template #footer>
        <BaseButton
          type="button"
          variant="primary"
          size="sm"
          class="w-full sm:w-auto"
          @click="abrirModalCriar"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Adicionar campo
        </BaseButton>
      </template>
    </BaseModal>

    <ModalCriarCampoPersonalizado
      v-if="workspaceId != null"
      v-model:open="modalFormCampoAberto"
      :workspace-id="workspaceId"
      :campo="campoParaModal"
      @salvo="onCampoSalvo"
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
  </section>
</template>
