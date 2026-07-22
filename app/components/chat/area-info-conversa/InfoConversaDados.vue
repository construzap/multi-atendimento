<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import type { Conversa, ConversaPatch } from '#shared/types/conversa'

type CampoEditavel = 'name' | 'phone' | 'coluna'

const INPUT_CLASS =
  '!rounded-lg !border-outline/30 !bg-white !py-2 text-sm dark:!border-dark-outline/30 dark:!bg-dark-surface-container-low'

const SELECT_CLASS =
  'w-full rounded-lg border border-outline/30 bg-white px-3 py-2 text-sm text-on-surface shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface'

const route = useRoute()
const conversasStore = useConversasStore()
const kanbanStore = useKanbanStore()
const workspacesStore = useWorkspacesStore()
const { pending: kanbanPending } = storeToRefs(kanbanStore)

const carregandoMetadados = ref(false)
const campoEmEdicao = ref<CampoEditavel | null>(null)
const draftValor = ref('')
const salvandoCampo = ref<CampoEditavel | null>(null)
const salvandoIa = ref(false)
const modalApagarMemoriaIaAberto = ref(false)
const apagandoMemoriaIa = ref(false)

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

function boardJaCarregado(wsId: number): boolean {
  return kanbanStore.loadedAt != null && kanbanStore.workspaceIdLoaded === wsId
}

const colunas = computed(() => kanbanStore.columns)

const aguardandoMetadados = computed(() => {
  const wsId = workspaceId.value
  if (!wsId || !conversa.value) return false
  if (boardJaCarregado(wsId)) return false
  return carregandoMetadados.value || kanbanPending.value
})

const nomeLabel = computed(() => {
  const nome = conversa.value?.name?.trim()
  return nome || '—'
})

const telefoneLabel = computed(() => {
  const phone = conversa.value?.phone?.trim()
  return phone || '—'
})

const iaLigada = computed(() => conversa.value?.ia_ligada === true)

const podeApagarMemoriaIa = computed(() => {
  const c = conversa.value
  const wsId = workspaceId.value
  if (!c || !wsId) return false
  if (c.is_group === true) return false
  return Boolean(c.key?.trim() && c.phone?.trim())
})

const textoModalApagarMemoriaIa = computed(() => {
  const tel = telefoneLabel.value
  return `Isso vai apagar a memória da I.A. para o número ${tel} e ligar o atendimento da I.A. para este contato. Esta ação não poderá ser desfeita. Tem certeza?`
})

function abrirModalApagarMemoriaIa() {
  if (!podeApagarMemoriaIa.value || apagandoMemoriaIa.value) return
  modalApagarMemoriaIaAberto.value = true
}

async function confirmarApagarMemoriaIa() {
  const c = conversa.value
  const wsId = workspaceId.value
  if (!c || !wsId || apagandoMemoriaIa.value) return

  const phone = c.phone?.trim()
  const key = c.key?.trim()
  if (!phone || !key) {
    toast.error('Telefone ou conversa não identificados.')
    return
  }

  apagandoMemoriaIa.value = true
  try {
    await $fetch('/api/conversas/apagar-memoria-ia', {
      method: 'POST',
      body: {
        workspace_id: wsId,
        key,
        phone,
      },
    })
    if (c.ia_ligada !== true) {
      await conversasStore.atualizarConversa(wsId, key, { ia_ligada: true }).catch(() => undefined)
    }
    modalApagarMemoriaIaAberto.value = false
    toast.success('Memória da I.A. apagada para este contato.')
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    toast.error(msg || 'Não foi possível apagar a memória da I.A.')
  } finally {
    apagandoMemoriaIa.value = false
  }
}

const colunaLabel = computed(() => {
  const colunaId = conversa.value?.coluna_id
  if (colunaId == null || colunaId < 1) return 'Sem coluna'
  if (aguardandoMetadados.value) return 'Carregando…'
  const coluna = colunas.value.find((c) => c.id === colunaId)
  return coluna?.nome?.trim() || `#${colunaId}`
})

const funilLabel = computed(() => {
  const funilId = conversa.value?.funil_id
  if (funilId == null) return '—'
  if (aguardandoMetadados.value) return 'Carregando…'
  if (kanbanStore.funilId === funilId && kanbanStore.funilNome.trim()) {
    return `${kanbanStore.funilNome.trim()} (#${funilId})`
  }
  return `#${funilId}`
})

function cancelarEdicao() {
  campoEmEdicao.value = null
  draftValor.value = ''
}

function iniciarEdicao(campo: CampoEditavel) {
  const c = conversa.value
  if (!c) return

  campoEmEdicao.value = campo
  if (campo === 'name') {
    draftValor.value = c.name ?? ''
  } else if (campo === 'phone') {
    draftValor.value = c.phone ?? ''
  } else {
    draftValor.value = c.coluna_id != null && c.coluna_id > 0 ? String(c.coluna_id) : ''
    void garantirMetadadosFunil()
  }
}

function montarPatchCampo(c: Conversa, campo: CampoEditavel): ConversaPatch | null {
  const patch: ConversaPatch = {}

  if (campo === 'name') {
    const nameAtual = (c.name ?? '').trim()
    const nameNovo = draftValor.value.trim()
    if (nameNovo === nameAtual) {
      toast.message('Nenhuma alteração para salvar.')
      return null
    }
    patch.name = nameNovo || null
    return patch
  }

  if (campo === 'phone') {
    const phoneAtual = (c.phone ?? '').trim()
    const phoneNovo = draftValor.value.trim()
    if (phoneNovo === phoneAtual) {
      toast.message('Nenhuma alteração para salvar.')
      return null
    }
    if (!phoneNovo) {
      toast.error('Informe um telefone válido.')
      return null
    }
    patch.phone = phoneNovo
    return patch
  }

  const colunaAtual = c.coluna_id ?? null
  const colunaNovoRaw = draftValor.value.trim()
  const colunaNovo = colunaNovoRaw ? Number.parseInt(colunaNovoRaw, 10) : null
  if (colunaNovoRaw && (!Number.isFinite(colunaNovo) || colunaNovo! < 1)) {
    toast.error('Selecione uma coluna válida.')
    return null
  }
  if (colunaNovo === colunaAtual) {
    toast.message('Nenhuma alteração para salvar.')
    return null
  }
  patch.coluna_id = colunaNovo
  return patch
}

async function garantirMetadadosFunil() {
  if (!import.meta.client) return

  const wsId = workspaceId.value
  if (!wsId || !conversa.value) return
  if (boardJaCarregado(wsId)) return

  carregandoMetadados.value = true
  try {
    await kanbanStore.ensureBoardLoaded(wsId)
  } catch {
    // `fetchBoard` já trata erro/toast no store.
  } finally {
    carregandoMetadados.value = false
  }
}

async function salvarCampo(campo: CampoEditavel) {
  const c = conversa.value
  const wsId = workspaceId.value
  if (!c || !wsId || salvandoCampo.value != null) return

  const patch = montarPatchCampo(c, campo)
  if (!patch) return

  salvandoCampo.value = campo
  try {
    await conversasStore.atualizarConversa(wsId, c.key, patch)
    toast.success('Dado atualizado.')
    cancelarEdicao()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    toast.error(msg || 'Não foi possível salvar o dado.')
  } finally {
    salvandoCampo.value = null
  }
}

async function alternarIaLigada() {
  const c = conversa.value
  const wsId = workspaceId.value
  if (!c || !wsId || salvandoIa.value) return

  const novoValor = !iaLigada.value
  salvandoIa.value = true
  try {
    await conversasStore.atualizarConversa(wsId, c.key, { ia_ligada: novoValor })
    toast.success(novoValor ? 'I.A. ligada.' : 'I.A. desligada.')
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    toast.error(msg || 'Não foi possível atualizar a I.A.')
  } finally {
    salvandoIa.value = false
  }
}

watch(
  conversa,
  () => {
    cancelarEdicao()
  },
)

watch(
  [conversa, workspaceId],
  () => {
    void garantirMetadadosFunil()
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="conversa" class="border-b border-outline-variant/10 px-6 pb-6 pt-4">
    <h3 class="mb-3 font-headline text-sm font-bold text-slate-900 dark:text-slate-100">
      Dados da conversa
    </h3>

    <dl
      class="space-y-3 rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40"
    >
      <!-- Nome -->
      <div class="group">
        <div v-if="campoEmEdicao !== 'name'" class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Nome
            </dt>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-all hover:bg-surface-container-high hover:text-primary group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
              aria-label="Editar nome"
              @click="iniciarEdicao('name')"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
            </button>
          </div>
          <dd class="text-sm text-on-surface dark:text-dark-on-surface">
            {{ nomeLabel }}
          </dd>
        </div>

        <div
          v-else
          class="space-y-2 rounded-xl border border-primary/20 bg-white/80 p-3 dark:border-primary/30 dark:bg-dark-surface-container-low/80"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Nome
          </p>
          <BaseInput
            id="info-conversa-nome"
            v-model="draftValor"
            name="name"
            autocomplete="name"
            :input-class="INPUT_CLASS"
            :disabled="salvandoCampo === 'name'"
          />
          <div class="flex justify-end gap-2">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              :disabled="salvandoCampo === 'name'"
              @click="cancelarEdicao"
            >
              Cancelar
            </BaseButton>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :loading="salvandoCampo === 'name'"
              :disabled="salvandoCampo === 'name'"
              @click="salvarCampo('name')"
            >
              Salvar
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Telefone -->
      <div class="group">
        <div v-if="campoEmEdicao !== 'phone'" class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Telefone
            </dt>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-all hover:bg-surface-container-high hover:text-primary group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
              aria-label="Editar telefone"
              @click="iniciarEdicao('phone')"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
            </button>
          </div>
          <dd class="text-sm text-on-surface dark:text-dark-on-surface">
            {{ telefoneLabel }}
          </dd>
        </div>

        <div
          v-else
          class="space-y-2 rounded-xl border border-primary/20 bg-white/80 p-3 dark:border-primary/30 dark:bg-dark-surface-container-low/80"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Telefone
          </p>
          <BaseInput
            id="info-conversa-phone"
            v-model="draftValor"
            name="phone"
            type="tel"
            autocomplete="tel"
            :input-class="INPUT_CLASS"
            :disabled="salvandoCampo === 'phone'"
          />
          <div class="flex justify-end gap-2">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              :disabled="salvandoCampo === 'phone'"
              @click="cancelarEdicao"
            >
              Cancelar
            </BaseButton>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :loading="salvandoCampo === 'phone'"
              :disabled="salvandoCampo === 'phone'"
              @click="salvarCampo('phone')"
            >
              Salvar
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Coluna -->
      <div class="group">
        <div v-if="campoEmEdicao !== 'coluna'" class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Coluna
            </dt>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-all hover:bg-surface-container-high hover:text-primary group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
              aria-label="Editar coluna"
              @click="iniciarEdicao('coluna')"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
            </button>
          </div>
          <dd
            class="text-sm text-on-surface dark:text-dark-on-surface"
            :class="{ 'italic text-on-surface-variant dark:text-dark-on-surface-variant': colunaLabel === 'Carregando…' }"
          >
            {{ colunaLabel }}
          </dd>
        </div>

        <div
          v-else
          class="space-y-2 rounded-xl border border-primary/20 bg-white/80 p-3 dark:border-primary/30 dark:bg-dark-surface-container-low/80"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Coluna
          </p>
          <div class="relative">
            <select
              id="info-conversa-coluna"
              v-model="draftValor"
              :class="SELECT_CLASS"
              :disabled="salvandoCampo === 'coluna' || aguardandoMetadados"
            >
              <option value="">
                {{ aguardandoMetadados ? 'Carregando colunas…' : 'Sem coluna' }}
              </option>
              <option v-for="coluna in colunas" :key="coluna.id" :value="String(coluna.id)">
                {{ coluna.nome }}
              </option>
            </select>
            <span
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined"
              aria-hidden="true"
            >
              expand_more
            </span>
          </div>
          <div class="flex justify-end gap-2">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              :disabled="salvandoCampo === 'coluna'"
              @click="cancelarEdicao"
            >
              Cancelar
            </BaseButton>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :loading="salvandoCampo === 'coluna'"
              :disabled="salvandoCampo === 'coluna'"
              @click="salvarCampo('coluna')"
            >
              Salvar
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Funil (somente leitura) -->
      <div class="flex flex-col gap-0.5">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Funil
        </dt>
        <dd
          class="text-sm text-on-surface dark:text-dark-on-surface"
          :class="{ 'italic text-on-surface-variant dark:text-dark-on-surface-variant': funilLabel === 'Carregando…' }"
        >
          {{ funilLabel }}
        </dd>
      </div>

      <!-- I.A. ligada -->
      <div class="flex flex-col gap-1.5">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          I.A.
        </dt>
        <dd>
          <div
            class="flex items-center justify-between gap-3 rounded-xl border border-outline/25 bg-white/70 px-3 py-2.5 dark:border-dark-outline/30 dark:bg-dark-surface-container-low/70"
            :class="salvandoIa ? 'opacity-70' : ''"
          >
            <div class="min-w-0 flex items-center gap-2.5">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                :class="iaLigada
                  ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                  : 'bg-zinc-500/10 text-zinc-500 dark:bg-zinc-400/10 dark:text-zinc-400'"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[18px]">
                  {{ iaLigada ? 'smart_toy' : 'psychology_alt' }}
                </span>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
                  Atendimento automático
                </p>
                <p
                  class="text-[11px] font-semibold tracking-wide"
                  :class="iaLigada
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-on-surface-variant dark:text-dark-on-surface-variant'"
                >
                  {{ iaLigada ? 'Ligada' : 'Desligada' }}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              :aria-checked="iaLigada"
              :aria-label="iaLigada ? 'Desligar I.A.' : 'Ligar I.A.'"
              :disabled="salvandoIa"
              class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-dark-surface-container-low"
              :class="iaLigada
                ? 'bg-emerald-500 shadow-inner shadow-emerald-900/20 dark:bg-emerald-500'
                : 'bg-zinc-300 dark:bg-zinc-600'"
              @click="alternarIaLigada"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-white/10"
                :class="iaLigada ? 'left-[calc(100%-1.4rem)]' : 'left-1'"
              />
            </button>
          </div>
        </dd>
      </div>
    </dl>

    <div v-if="podeApagarMemoriaIa" class="mt-3 flex justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-600 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400"
        :disabled="apagandoMemoriaIa"
        aria-label="Apagar memória da I.A. para este contato"
        @click="abrirModalApagarMemoriaIa"
      >
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">memory_alt</span>
        Apagar memória da I.A.
      </button>
    </div>

    <ModalAlerta
      v-model:open="modalApagarMemoriaIaAberto"
      title="Apagar memória da I.A.?"
      :texto="textoModalApagarMemoriaIa"
      variante="perigo"
      texto-confirmar="Apagar memória"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="apagandoMemoriaIa"
      :cancelar-desabilitado="apagandoMemoriaIa"
      :mostrar-fechar="!apagandoMemoriaIa"
      @confirmar="confirmarApagarMemoriaIa"
    />
  </section>
</template>
