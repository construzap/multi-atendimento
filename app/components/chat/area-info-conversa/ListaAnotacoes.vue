<script setup lang="ts">
import { storeToRefs } from 'pinia'
import ItemAnotacao from '~/components/chat/area-info-conversa/ItemAnotacao.vue'
import { useAnotacoesStore } from '~/stores/anotacoes'
import { useConversasStore } from '~/stores/conversas'
import { useWorkspacesStore } from '~/stores/workspaces'

const conversas = useConversasStore()
const workspaces = useWorkspacesStore()
const anotacoes = useAnotacoesStore()
const { conversaAtual } = storeToRefs(conversas)

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null ? Number.parseInt(String(raw), 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

const conversa = computed(() => {
  const key = conversaAtual.value?.trim()
  if (!key) return null
  return conversas.findConversaByKey(key)
})

/** Mais recente → mais antiga (API + Pinia). */
const itens = computed(() => conversa.value?.anotacoes ?? [])

const temAnotacoes = computed(() => itens.value.length > 0)

const temMais = computed(() => {
  const lista = conversa.value?.anotacoes
  if (lista === undefined) return false
  const total = conversa.value?.anotacoes_meta?.total ?? lista.length
  return lista.length < total
})

const carregandoMais = computed(() => {
  const key = conversaAtual.value?.trim()
  if (!key) return false
  return anotacoes.pendingMoreDaConversa(key)
})

const mostrarSecao = computed(() => temAnotacoes.value || temMais.value)

function formatarDataHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const agora = new Date()
  const mesmaHora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const inicioOntem = inicioHoje - 24 * 60 * 60 * 1000
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (t === inicioHoje) return `hoje às ${mesmaHora}`
  if (t === inicioOntem) return `ontem às ${mesmaHora}`
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

async function carregarMais() {
  const key = conversaAtual.value?.trim()
  const wsId = workspaceId.value
  if (!key || wsId == null || carregandoMais.value) return
  try {
    await anotacoes.carregarMais(wsId, key)
  } catch {
    /* silencioso — botão permanece se ainda houver mais */
  }
}

watch(
  [conversaAtual, workspaceId],
  ([key, wsId]) => {
    const k = key?.trim()
    if (!k || wsId == null) return
    void anotacoes.fetchDaConversa(wsId, k).catch(() => {
      /* erro silencioso */
    })
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="mostrarSecao" class="space-y-3 px-6 pb-6 pt-4">
    <div v-if="temAnotacoes" class="space-y-3">
      <ItemAnotacao
        v-for="item in itens"
        :key="item.id"
        :id="item.id"
        :workspace-id="workspaceId!"
        :conversa-key="item.conversa_key"
        autor="Anotação"
        :data-hora="formatarDataHora(item.created_at)"
        :texto="item.anotacao_text"
        :tipo="item.tipo_anotacao"
        :media-url="item.media_url"
      />
    </div>

    <div v-if="temMais" class="flex justify-center pt-1">
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        :disabled="carregandoMais"
        @click="carregarMais"
      >
        {{ carregandoMais ? 'Carregando…' : 'Carregar mais' }}
      </button>
    </div>
  </section>
</template>
