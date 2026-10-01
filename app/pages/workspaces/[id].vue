<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Workspace } from '#shared/types/workspace'
import { useSomPedidoStore } from '~/stores/somPedido'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaces = useWorkspacesStore()
const somPedido = useSomPedidoStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

/** Produtos: o wrapper não cresce com a lista — só a tabela rola. */
const travaViewportProdutos = computed(() => {
  const p = route.path
  if (p.includes('/produtos/enviar-para-ia')) return false
  return /\/workspaces\/[^/]+\/produtos\/?$/.test(p)
})

// 1) Busca workspaces (SSR-friendly) se ainda não estiverem no Pinia.
if (import.meta.server && workspaces.items.length === 0) {
  const ufetch = useRequestFetch()
  try {
    const data = await ufetch<Workspace[]>('/api/workspaces', { method: 'GET' })
    workspaces.items = data ?? []
  } catch {
    // Se não autenticado, o middleware de auth do supabase já deve redirecionar.
    // Aqui só evitamos quebrar a renderização.
  }
}

// 2) Pega o workspace pela rota e 3) valida se pertence ao user.
watch(
  workspaceId,
  async (id) => {
    if (id == null) {
      await navigateTo('/', { replace: true })
      return
    }

    // Client: se veio direto pela URL e o Pinia ainda está vazio, carrega com auth.
    if (import.meta.client && workspaces.items.length === 0 && !workspaces.pending) {
      const ufetch = useRequestFetch()
      try {
        const data = await ufetch<Workspace[]>('/api/workspaces', { method: 'GET' })
        workspaces.items = data ?? []
      } catch {
        workspaces.items = []
      }
    }

    const belongs = workspaces.items.some((w) => w.id === id)
    if (!belongs) {
      workspaces.setCurrentWorkspaceId(null)
      await navigateTo('/', { replace: true })
      return
    }

    workspaces.setCurrentWorkspaceId(String(id))
  },
  { immediate: true }
)

onMounted(() => {
  somPedido.hidratar()
})

async function aceitarSomENotificacoes() {
  const ok = await somPedido.permitir()
  if (ok) {
    toast.success('Som ativo. O sino toca mesmo se você estiver em outra aba.')
    return
  }
  toast.message('Som e notificações desativados. O navegador não permitiu.')
}

function recusarSomENotificacoes() {
  somPedido.desativar()
  toast.message('Som e notificações desativados.')
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col"
    :class="travaViewportProdutos ? 'h-full min-h-0 overflow-hidden' : ''"
  >
    <NuxtPage :key="route.fullPath" />

    <BaseModal
      :open="somPedido.modalAberto"
      title="Som e notificações de pedido"
      :show-close="false"
      :close-on-backdrop="false"
      :close-on-escape="false"
      panel-class="w-full max-w-md"
      @update:open="somPedido.modalAberto = $event"
    >
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Para o sino tocar quando chegar um pedido — mesmo se você estiver em outra aba — o navegador precisa permitir o som e as notificações.
      </p>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-outline/40 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-dark-outline/40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="recusarSomENotificacoes"
        >
          Não permitir
        </button>
        <button
          type="button"
          class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          @click="aceitarSomENotificacoes"
        >
          Permitir
        </button>
      </div>
    </BaseModal>
  </div>
</template>

