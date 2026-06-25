<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ItemConversa from '~/components/chat/area-conversa/ItemConversa.vue'
import type { Conversa } from '#shared/types/conversa'
import type { MessageType } from '#shared/types/messageType'

type ConversaListaItem = {
  id: string
  nome: string
  ultimaMensagem: string
  horario: string
  avatarSrc: string | null
  messatype: MessageType | null
  fechada: boolean
  isGrupo: boolean
  naoLidas: number
}

const canais = useCanaisStore()
const conversas = useConversasStore()
const { termoPesquisa } = storeToRefs(conversas)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function labelPreview(m: Conversa): string {
  const t = (m.messatype ?? '').trim()
  const low = t.toLowerCase()
  if (!low || low === 'conversation') return firstNonEmpty(m.message, '')
  if (low === 'audiomessage') return 'Enviou um áudio'
  if (low === 'documentmessage') return 'Enviou um documento'
  if (low === 'imagemessage') return 'Enviou uma imagem'
  if (low === 'videomessage') return 'Enviou um vídeo'
  if (low === 'stickermessage') return 'Enviou um sticker'
  if (low === 'locationmessage') return 'Localização — veja no WhatsApp'
  if (low === 'livelocationmessage') return 'Localização ao vivo — veja no WhatsApp'
  return 'Enviou uma mensagem'
}

function formatHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function sortIsoAsc(a: string | null, b: string | null): number {
  const da = a ? new Date(a).getTime() : 0
  const db = b ? new Date(b).getTime() : 0
  return da - db
}

function previewTexto(m: Conversa): string {
  return labelPreview(m) || ' '
}

function conversaMatchesPesquisa(m: Conversa, q: string): boolean {
  if (!q) return true
  const ql = q.toLowerCase()
  const haystack = [
    m.name,
    m.phone,
    m.lid,
    m.message,
    m.key,
    m.name_group,
    m.id_group,
  ]
    .map((v) => (v ?? '').toLowerCase())
    .join(' ')
  return haystack.includes(ql)
}

const itens = computed<ConversaListaItem[]>(() => {
  // Se não houver canal selecionado, não lista nada.
  if (!canais.currentCanalId) return []

  const q = termoPesquisa.value.trim()
  const msgs = conversas.items.filter((m) => conversaMatchesPesquisa(m, q))
  if (!msgs.length) return []

  const sorted = [...msgs].sort((a, b) => {
    const ta = a.updated_at ?? a.created_at
    const tb = b.updated_at ?? b.created_at
    return sortIsoAsc(tb ?? null, ta ?? null)
  })

  return sorted.map((m) => ({
    id: m.key,
    nome: firstNonEmpty(m.name, m.phone, m.lid, m.key),
    ultimaMensagem: previewTexto(m) || ' ',
    horario: formatHora(m.updated_at ?? m.created_at),
    avatarSrc: m.photo ?? null,
    messatype: m.messatype ?? null,
    fechada: m.conversa_aberta === false,
    isGrupo: m.is_group === true,
    naoLidas: m.nao_lidas ?? 0,
  }))
})

// Se a lista trocar (ex.: canal mudou), não auto-seleciona nada.
watch(
  itens,
  (list) => {
    if (!list.length) {
      conversas.setConversaAtual(null)
      return
    }
    const cur = conversas.conversaAtual
    // Se a conversa atual não existir mais no novo conjunto, apenas limpa a seleção.
    if (cur && !list.some((x) => x.id === cur)) conversas.setConversaAtual(null)
  },
  { immediate: true }
)

const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null

function onScroll() {
  isScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    isScrolling.value = false
    scrollTimer = null
  }, 900)

  maybeLoadMore()
}

const scroller = ref<HTMLElement | null>(null)
let loadMoreLock = false

function maybeLoadMore() {
  const el = scroller.value
  if (!el) return
  if (loadMoreLock) return
  if (!conversas.hasMore) return
  if (conversas.pending) return

  const thresholdPx = 64
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx
  if (!atBottom) return

  loadMoreLock = true
  conversas
    .fetchNextPage()
    .catch(() => {
      /* erro já fica em conversas.error */
    })
    .finally(() => {
      // pequeno cooldown pra evitar flood em scroll “tremido”
      setTimeout(() => {
        loadMoreLock = false
      }, 250)
    })
}
</script>

<template>
  <!-- `h-0` em flex child força overflow interno (evita esticar a página). -->
  <div
    ref="scroller"
    class="lista-conversas-scroll flex h-0 min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-2"
    :class="isScrolling ? 'is-scrolling' : ''"
    @scroll="onScroll"
  >
    <div class="flex flex-col gap-2">
      <ItemConversa
        v-for="c in itens"
        :key="c.id"
        :conversa-id="c.id"
        :nome="c.nome"
        :ultima-mensagem="c.ultimaMensagem"
        :horario="c.horario"
        :avatar-src="c.avatarSrc"
        :messatype="c.messatype"
        :fechada="c.fechada"
        :is-grupo="c.isGrupo"
        :nao-lidas="c.naoLidas"
        :selected="c.id === conversas.conversaAtual"
        @select="conversas.setConversaAtual(c.id)"
      />

      <p
        v-if="!conversas.pending && itens.length === 0"
        class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        <template v-if="!canais.currentCanalId">Selecione um canal para ver as conversas.</template>
        <template v-else-if="termoPesquisa.trim()">
          Nenhuma conversa encontrada para “{{ termoPesquisa.trim() }}”.
        </template>
        <template v-else>Nenhuma conversa carregada para este canal.</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Scrollbar discreta: some e aparece ao rolar/hover */
.lista-conversas-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent; /* Firefox */
}
.lista-conversas-scroll::-webkit-scrollbar {
  width: 10px;
}
.lista-conversas-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.lista-conversas-scroll::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 999px;
  border: 3px solid transparent; /* cria “respiro” */
  background-clip: content-box;
}

/* Aparece quando hover ou quando está rolando */
.lista-conversas-scroll:hover {
  scrollbar-color: rgba(148, 163, 184, 0.55) transparent; /* slate-400 */
}
.lista-conversas-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.55);
}

.lista-conversas-scroll.is-scrolling {
  scrollbar-color: rgba(148, 163, 184, 0.85) transparent;
}
.lista-conversas-scroll.is-scrolling::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.85);
}

/* Dark mode */
:global(.dark) .lista-conversas-scroll:hover {
  scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
}
:global(.dark) .lista-conversas-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.35);
}
:global(.dark) .lista-conversas-scroll.is-scrolling {
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}
:global(.dark) .lista-conversas-scroll.is-scrolling::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.6);
}
</style>
