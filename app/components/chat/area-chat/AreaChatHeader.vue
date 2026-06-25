<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Conversa } from '#shared/types/conversa'
import { useMensagensStore } from '~/stores/mensagens'

const conversasStore = useConversasStore()
const canaisStore = useCanaisStore()
const mensagensStore = useMensagensStore()
const { conversaAtual, items } = storeToRefs(conversasStore)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function sortIsoAsc(a: string | null, b: string | null): number {
  const da = a ? new Date(a).getTime() : 0
  const db = b ? new Date(b).getTime() : 0
  return da - db
}

const conversaSelecionada = computed<Conversa | null>(() => {
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null

  const filtrada = list.filter((m) => m.key === key)
  if (!filtrada.length) return null

  // Pega o registro mais recente dessa conversa para extrair nome/foto/phone.
  const sorted = [...filtrada].sort((a, b) => {
    const ta = a.updated_at ?? a.created_at
    const tb = b.updated_at ?? b.created_at
    return sortIsoAsc(ta ?? null, tb ?? null)
  })
  return sorted[sorted.length - 1] ?? null
})

const avatarUrl = computed<string | undefined>(() => conversaSelecionada.value?.photo ?? undefined)
const nome = computed(() => {
  const c = conversaSelecionada.value
  if (!c) return conversaAtual.value ?? ''
  return firstNonEmpty(c.name, c.phone, c.lid, conversaAtual.value)
})
const telefone = computed(() => {
  const c = conversaSelecionada.value
  if (!c) return conversaAtual.value ?? ''
  if (c.is_group) return firstNonEmpty(c.phone, 'Grupo')
  return firstNonEmpty(c.phone, conversaAtual.value)
})

function fecharConversa() {
  const key = conversaAtual.value
  if (!key) return
  conversasStore
    .fecharConversa(key)
    .catch((err: unknown) => {
      toast.error(erroExclusaoFetch(err), { duration: 8000 })
    })
}

const modalExcluirAberto = ref(false)
const excluindo = ref(false)

const podeExcluir = computed(() => Boolean(mensagensStore.activeKey))

function erroExclusaoFetch(err: unknown): string {
  if (err && typeof err === 'object') {
    const data = (err as { data?: { statusMessage?: string } }).data
    if (typeof data?.statusMessage === 'string' && data.statusMessage.trim()) {
      return data.statusMessage.trim()
    }
    const msg = (err as { message?: string }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível excluir a conversa.'
}

function abrirModalExcluir() {
  modalExcluirAberto.value = true
}

async function onConfirmarExclusaoConversa() {
  const key = mensagensStore.activeKey
  if (!key) {
    modalExcluirAberto.value = false
    return
  }

  const canalId = canaisStore.currentCanalId
  const convAtual = conversasStore.conversaAtual

  excluindo.value = true
  try {
    await $fetch('/api/conversas/deletar', {
      method: 'POST',
      body: { key }
    })
    conversasStore.removeConversaByDbKey(key)
    if (canalId != null && convAtual != null && convAtual === key) {
      conversasStore.setConversaAtual(null)
    }
    mensagensStore.afterConversaDeleted(key)
    toast.success('Conversa excluída permanentemente.')
    modalExcluirAberto.value = false
  } catch (err: unknown) {
    toast.error(erroExclusaoFetch(err), { duration: 8000 })
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-white px-6 dark:bg-slate-950"
  >
    <div class="flex min-w-0 items-center gap-3 pl-12 md:pl-0">
      <BaseAvatar :image-url="avatarUrl" :alt="nome" :size="40" variant="circle" />
      <div class="min-w-0">
        <h2 class="truncate font-headline text-base font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h2>
        <p class="text-[10px] text-on-surface-variant dark:text-slate-400">
          {{ telefone }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-danger disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-danger"
        aria-label="Excluir conversa"
        :disabled="!podeExcluir || excluindo"
        @click="abrirModalExcluir"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">delete</span>
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
        @click="fecharConversa"
      >
        Fechar conversa
      </button>
    </div>

    <ModalAlerta
      v-model:open="modalExcluirAberto"
      title="Excluir conversa?"
      texto="A conversa e todas as mensagens serão apagadas permanentemente do banco. Esta ação não poderá ser desfeita."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindo"
      :cancelar-desabilitado="excluindo"
      @confirmar="onConfirmarExclusaoConversa"
    />
  </header>
</template>
