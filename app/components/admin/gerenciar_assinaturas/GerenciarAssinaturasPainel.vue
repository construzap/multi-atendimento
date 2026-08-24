<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import type { AdminAtualizarPerfilBody } from '#shared/types/adminGerenciarAssinaturas'
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
}

const adminStore = useAdminStore()
const assinaturasStore = useAdminGerenciarAssinaturasStore()

const { selectedWorkspaceId, workspaceSelecionado } = storeToRefs(adminStore)
const { perfil, pending, salvando, loaded, error: errorMsg } = storeToRefs(assinaturasStore)

const draft = ref<PerfilDraft>({
  email: '',
  full_name: '',
  data_expiracao: '',
  whatsapp: '',
  customer: '',
  subscription_id: '',
  canais: 1,
  limite_ias: 0,
})

async function carregar(userId: string, { force = false } = {}) {
  try {
    await assinaturasStore.fetchPorUserId(userId, { force })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os dados da assinatura.'))
  }
}

watch(
  () => workspaceSelecionado.value?.user_id,
  (userId) => {
    if (!userId) {
      assinaturasStore.clear()
      return
    }

    carregar(userId).catch(() => {})
  },
  { immediate: true },
)

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
    Number(p.limite_ias ?? 0) !== Number(d.limite_ias)
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
      v-if="!selectedWorkspaceId"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400"
        aria-hidden="true"
      >
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2 10h20" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Selecione um workspace
      </p>
      <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha um workspace na barra lateral para ver e editar os dados de assinatura do dono.
      </p>
    </div>

    <div
      v-else-if="pending && !loaded"
      class="flex flex-1 items-center justify-center py-16 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Carregando dados da assinatura...
    </div>

    <div
      v-else-if="errorMsg && !perfil"
      class="rounded-2xl border border-danger/30 bg-danger-container/20 px-4 py-3 text-sm text-danger dark:text-dark-danger"
    >
      {{ errorMsg }}
    </div>

    <div
      v-else-if="loaded && !perfil"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Perfil não encontrado
      </p>
      <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Não há registro em <code class="text-xs">profiles</code> para o dono deste workspace.
      </p>
    </div>

    <section
      v-else-if="perfil"
      class="rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <header class="border-b border-outline/30 px-5 py-4 dark:border-dark-outline/30">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspace selecionado
        </p>
        <h2 class="mt-0.5 font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
          {{ workspaceSelecionado?.nome ?? 'Workspace' }}
        </h2>
        <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ perfil.full_name || perfil.email || perfil.user_id }}
        </p>
      </header>

      <form class="space-y-5 p-5" @submit.prevent="salvar">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              ID do perfil
            </span>
            <input
              :value="perfil.id"
              type="text"
              readonly
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high/60 px-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high/60 dark:text-dark-on-surface-variant"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              User ID
            </span>
            <input
              :value="perfil.user_id"
              type="text"
              readonly
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high/60 px-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high/60 dark:text-dark-on-surface-variant"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Criado em
            </span>
            <input
              :value="formatarData(perfil.created_at)"
              type="text"
              readonly
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high/60 px-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high/60 dark:text-dark-on-surface-variant"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              E-mail
            </span>
            <input
              v-model="draft.email"
              type="email"
              required
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Nome completo
            </span>
            <input
              v-model="draft.full_name"
              type="text"
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Data de expiração
            </span>
            <input
              v-model="draft.data_expiracao"
              type="datetime-local"
              required
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              WhatsApp
            </span>
            <input
              v-model="draft.whatsapp"
              type="text"
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Customer
            </span>
            <input
              v-model="draft.customer"
              type="text"
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Subscription ID
            </span>
            <input
              v-model="draft.subscription_id"
              type="text"
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Canais (limite)
            </span>
            <input
              v-model.number="draft.canais"
              type="number"
              min="0"
              step="1"
              required
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Limite de I.A.s
            </span>
            <input
              v-model.number="draft.limite_ias"
              type="number"
              min="0"
              step="1"
              required
              :disabled="salvando"
              class="h-11 w-full rounded-xl border border-outline/40 bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:focus:ring-primary-900/40"
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
