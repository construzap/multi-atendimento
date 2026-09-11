<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import type { AdminAtualizarPerfilBody } from '#shared/types/adminGerenciarAssinaturas'
import type { UserRole } from '#shared/types/profile'
import { mensagemErroFetch } from '~/stores/canais'
import { useAdminGerenciarAssinaturasStore } from '~/stores/adminGerenciarAssinaturas'

type PerfilDraft = {
  email: string
  full_name: string
  data_expiracao: string
  whatsapp: string
  customer: string
  subscription_id: string
  canais: number
  limite_ias: number
  limite_mensal_token: number
  role: UserRole
}

const inputClass =
  'h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40'
const readonlyClass =
  'h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high/60 px-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high/60 dark:text-dark-on-surface-variant'
const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant'

const assinaturasStore = useAdminGerenciarAssinaturasStore()

const {
  perfilSelecionado: perfil,
  selectedUserId,
  salvando,
  loaded,
  error: errorMsg,
  workspaces,
  workspacesPending,
  workspacesError,
} = storeToRefs(assinaturasStore)

const draft = ref<PerfilDraft>({
  email: '',
  full_name: '',
  data_expiracao: '',
  whatsapp: '',
  customer: '',
  subscription_id: '',
  canais: 1,
  limite_ias: 0,
  limite_mensal_token: 0,
  role: 'MEMBRO',
})

function toDatetimeLocal(valor: string | null | undefined): string {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

function formatarNumero(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return new Intl.NumberFormat('pt-BR').format(valor)
}

/** Exibe inteiro com milhar pt-BR (ex.: 1000000 → 1.000.000). */
function formatInteiroPtBr(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.trunc(valor)),
  )
}

function parseInteiroPtBr(raw: string): number | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

type CampoInteiroDraft = 'canais' | 'limite_ias' | 'limite_mensal_token'

function onInteiroInput(campo: CampoInteiroDraft, event: Event) {
  const el = event.target as HTMLInputElement
  const parsed = parseInteiroPtBr(el.value)
  if (parsed == null) {
    draft.value[campo] = 0
    el.value = ''
    return
  }
  draft.value[campo] = parsed
  el.value = formatInteiroPtBr(parsed)
}

watch(
  perfil,
  (p) => {
    if (!p) return
    draft.value = {
      email: p.email ?? '',
      full_name: p.full_name ?? '',
      data_expiracao: toDatetimeLocal(p.data_expiracao),
      whatsapp: p.whatsapp ?? '',
      customer: p.customer ?? '',
      subscription_id: p.subscription_id ?? '',
      canais: p.canais ?? 0,
      limite_ias: p.limite_ias ?? 0,
      limite_mensal_token: p.limite_mensal_token ?? 0,
      role: p.role === 'ADMIN' ? 'ADMIN' : 'MEMBRO',
    }
  },
  { immediate: true },
)

const alterado = computed(() => {
  if (!perfil.value) return false
  const p = perfil.value
  const d = draft.value
  return (
    (p.email ?? '') !== d.email.trim() ||
    (p.full_name ?? '') !== d.full_name.trim() ||
    toDatetimeLocal(p.data_expiracao) !== d.data_expiracao ||
    (p.whatsapp ?? '') !== d.whatsapp.trim() ||
    (p.customer ?? '') !== d.customer.trim() ||
    (p.subscription_id ?? '') !== d.subscription_id.trim() ||
    Number(p.canais ?? 0) !== Number(d.canais) ||
    Number(p.limite_ias ?? 0) !== Number(d.limite_ias) ||
    Number(p.limite_mensal_token ?? 0) !== Number(d.limite_mensal_token) ||
    p.role !== d.role
  )
})

async function salvar() {
  if (!perfil.value || salvando.value || !alterado.value) return

  const email = draft.value.email.trim()
  if (!email) {
    toast.error('Informe um e-mail válido.')
    return
  }

  if (!draft.value.data_expiracao) {
    toast.error('Informe a data de expiração.')
    return
  }

  const body: AdminAtualizarPerfilBody = {
    user_id: perfil.value.user_id,
    email,
    full_name: draft.value.full_name.trim() || null,
    data_expiracao: new Date(draft.value.data_expiracao).toISOString(),
    whatsapp: draft.value.whatsapp.trim() || null,
    customer: draft.value.customer.trim() || null,
    subscription_id: draft.value.subscription_id.trim() || null,
    canais: Number(draft.value.canais),
    limite_ias: Number(draft.value.limite_ias),
    limite_mensal_token: Number(draft.value.limite_mensal_token),
    role: draft.value.role,
  }

  try {
    await assinaturasStore.atualizarPerfil(body)
    toast.success('Perfil atualizado com sucesso.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o perfil.'))
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div
      v-if="!selectedUserId"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400"
        aria-hidden="true"
      >
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Selecione um perfil
      </p>
      <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha um perfil na barra lateral para ver os detalhes da assinatura e dos limites.
      </p>
    </div>

    <div
      v-else-if="loaded && !perfil"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Perfil não encontrado
      </p>
    </div>

    <section
      v-else-if="perfil"
      class="rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <header class="border-b border-outline/30 px-5 py-4 dark:border-dark-outline/30">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Perfil selecionado
        </p>
        <h2 class="mt-0.5 font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
          {{ perfil.full_name || perfil.email || perfil.user_id }}
        </h2>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span class="rounded-md bg-surface-container-high px-2 py-1 font-medium capitalize text-on-surface dark:bg-dark-surface-container-high dark:text-dark-on-surface">
            Assinatura: {{ perfil.status_assinatura || '—' }}
          </span>
          <span class="rounded-md bg-surface-container-high px-2 py-1 font-medium capitalize text-on-surface dark:bg-dark-surface-container-high dark:text-dark-on-surface">
            Tokens: {{ perfil.status_limite_tokens || '—' }}
          </span>
          <span class="rounded-md bg-surface-container-high px-2 py-1 font-medium text-on-surface dark:bg-dark-surface-container-high dark:text-dark-on-surface">
            Role: {{ perfil.role }}
          </span>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-3 border-b border-outline/30 px-5 py-4 md:grid-cols-2 lg:grid-cols-3 dark:border-dark-outline/30">
        <div class="rounded-xl bg-surface-container-high/70 px-3 py-2.5 dark:bg-dark-surface-container-high/70">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Canais criados
          </p>
          <p class="mt-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ formatarNumero(perfil.canais_criados) }}
          </p>
        </div>
        <div class="rounded-xl bg-surface-container-high/70 px-3 py-2.5 dark:bg-dark-surface-container-high/70">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            I.A.s atreladas
          </p>
          <p class="mt-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ formatarNumero(perfil.ias_atreladas) }}
          </p>
        </div>
        <div class="rounded-xl bg-surface-container-high/70 px-3 py-2.5 dark:bg-dark-surface-container-high/70">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Tokens usados
          </p>
          <p class="mt-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ formatarNumero(perfil.total_tokens_usados) }}
          </p>
        </div>
        <div class="rounded-xl bg-surface-container-high/70 px-3 py-2.5 dark:bg-dark-surface-container-high/70">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Criado em
          </p>
          <p class="mt-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ formatarData(perfil.created_at) }}
          </p>
        </div>
      </div>

      <div class="border-b border-outline/30 px-5 py-4 dark:border-dark-outline/30">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspaces do perfil
        </p>

        <p
          v-if="workspacesPending"
          class="mt-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Carregando workspaces...
        </p>

        <p
          v-else-if="workspacesError"
          class="mt-2 text-sm text-danger dark:text-dark-danger"
        >
          {{ workspacesError }}
        </p>

        <p
          v-else-if="!workspaces.length"
          class="mt-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Nenhum workspace encontrado para este perfil.
        </p>

        <ul
          v-else
          class="mt-2 flex flex-wrap gap-2"
        >
          <li
            v-for="ws in workspaces"
            :key="ws.id"
            class="rounded-lg bg-sky-500/10 px-2.5 py-1 text-sm font-medium text-sky-800 dark:text-sky-300"
          >
            {{ ws.nome || `Workspace #${ws.id}` }}
          </li>
        </ul>
      </div>

      <form class="space-y-5 p-5" @submit.prevent="salvar">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="block">
            <span :class="labelClass">ID do perfil</span>
            <input :value="perfil.id" type="text" readonly :class="readonlyClass" />
          </label>

          <label class="block">
            <span :class="labelClass">User ID</span>
            <input :value="perfil.user_id" type="text" readonly :class="readonlyClass" />
          </label>

          <label class="block">
            <span :class="labelClass">E-mail</span>
            <input
              v-model="draft.email"
              type="email"
              required
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block">
            <span :class="labelClass">Nome completo</span>
            <input
              v-model="draft.full_name"
              type="text"
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block md:col-span-2">
            <span :class="labelClass">Data de expiração</span>
            <input
              v-model="draft.data_expiracao"
              type="datetime-local"
              required
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block">
            <span :class="labelClass">WhatsApp</span>
            <input
              v-model="draft.whatsapp"
              type="text"
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block">
            <span :class="labelClass">Role</span>
            <select
              v-model="draft.role"
              :disabled="salvando"
              :class="inputClass"
            >
              <option value="MEMBRO">MEMBRO</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <label class="block">
            <span :class="labelClass">Customer (Stripe)</span>
            <input
              v-model="draft.customer"
              type="text"
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block">
            <span :class="labelClass">Subscription ID</span>
            <input
              v-model="draft.subscription_id"
              type="text"
              :disabled="salvando"
              :class="inputClass"
            />
          </label>

          <label class="block">
            <span :class="labelClass">Canais (limite)</span>
            <input
              :value="formatInteiroPtBr(draft.canais)"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              required
              :disabled="salvando"
              :class="inputClass"
              @input="onInteiroInput('canais', $event)"
            />
          </label>

          <label class="block">
            <span :class="labelClass">Limite de I.A.s</span>
            <input
              :value="formatInteiroPtBr(draft.limite_ias)"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              required
              :disabled="salvando"
              :class="inputClass"
              @input="onInteiroInput('limite_ias', $event)"
            />
          </label>

          <label class="block md:col-span-2">
            <span :class="labelClass">Limite mensal de tokens</span>
            <input
              :value="formatInteiroPtBr(draft.limite_mensal_token)"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              required
              :disabled="salvando"
              :class="inputClass"
              @input="onInteiroInput('limite_mensal_token', $event)"
            />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-outline/30 pt-4 dark:border-dark-outline/30">
          <BaseButton
            type="submit"
            variant="primary"
            size="sm"
            :block="false"
            :disabled="salvando || !alterado"
          >
            {{ salvando ? 'Salvando...' : 'Salvar alterações' }}
          </BaseButton>

          <p
            v-if="errorMsg"
            class="text-sm text-danger dark:text-dark-danger"
          >
            {{ errorMsg }}
          </p>
        </div>
      </form>
    </section>
  </div>
</template>
