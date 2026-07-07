<script setup lang="ts">

import { computed, nextTick, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import AreaChatHeader from '../../chat/area-chat/AreaChatHeader.vue'

import BalaoMensagem from '../../chat/area-chat/BalaoMensagens/BalaoMensagem.vue'

import ConversaRodape from './ConversaRodape.vue'

import type { Conversa } from '#shared/types/conversa'

import type { KanbanCard } from '#shared/types/kanban'

import { useConversasStore } from '../../../stores/conversas'

import { useKanbanStore } from '../../../stores/kanban'

import { useMensagensStore, mensagensBucketKey } from '../../../stores/mensagens'



const kanban = useKanbanStore()

const conversas = useConversasStore()

const mensagens = useMensagensStore()

const {
  items: mensagensItems,
  pending: mensagensPending,
  error: mensagensError,
  hasMore: mensagensHasMore,
} = storeToRefs(mensagens)



const { infoContatoConversaKey, infoContatoCard, infoContatoIdCanal, infoContatoEhGrupo } =

  storeToRefs(kanban)



const activeKey = computed(() => infoContatoConversaKey.value)

const idCanal = computed(() => infoContatoIdCanal.value)

const ehGrupo = computed(() => infoContatoEhGrupo.value)



const mostrarHeader = computed(() => Boolean(activeKey.value && idCanal.value != null))



function conversaFromKanbanCard(card: KanbanCard): Conversa {

  return {

    key: card.conversa_key,

    message: card.preview,

    messatype: null,

    name: card.name,

    created_at: null,

    updated_at: card.updated_at,

    id_canal: card.id_canal,

    phone: card.phone,

    lid: card.lid,

    connect_phone: null,

    photo: card.photo,

    from_me: null,

    media_url: null,

    conversa_aberta: true,

    is_group: card.is_group,

    id_group: null,

    name_group: null,

    nao_lidas: card.nao_lidas ?? 0,

  }

}



/** Espelha o card na store de conversas para o `AreaChatHeader` (sem alterar `canais.currentCanalId`). */

function syncConversaStoreFromKanbanCard() {

  const key = activeKey.value

  const card = infoContatoCard.value

  const canalId = idCanal.value

  if (!key || !card || canalId == null) return



  conversas.setActiveCanalId(canalId)

  conversas.addOrUpdateLocalConversa(conversaFromKanbanCard(card), canalId)

  conversas.setConversaAtual(key, canalId)

}



async function finishScrollOnOpen() {

  await nextTick()

  await scrollToBottom()

  requestAnimationFrame(() => {

    void scrollToBottom().then(() => {

      shouldScrollOnOpen.value = false

      updateIsAtBottom()

      updateIsAtTop()

    })

  })

}



watch(

  [activeKey, idCanal],

  async ([key, canalId]) => {

    if (!key) {

      mensagens.setActiveKey(conversas.conversaAtual)

      return

    }



    syncConversaStoreFromKanbanCard()

    shouldScrollOnOpen.value = true

    mensagens.setActiveKey(mensagensBucketKey(key))



    if (canalId == null) {

      shouldScrollOnOpen.value = false

      return

    }

    if (String(key).startsWith('temp:')) {

      await finishScrollOnOpen()

      return

    }

    // Carregamento via plugin `mensagens-conversa-sync` (evita GET duplicado).

  },

  { immediate: true },

)



watch(

  [() => mensagensPending.value, () => mensagensItems.value.length, activeKey],

  async ([pending, len, key]) => {

    if (!key || !shouldScrollOnOpen.value) return

    if (pending && len === 0) return

    await finishScrollOnOpen()

  },

)



/** Fechar ou excluir conversa no header fecha o modal do kanban. */

watch(

  () => conversas.conversaAtual,

  (key) => {

    const kanbanKey = activeKey.value

    if (!kanbanKey) return

    if (key === kanbanKey) return

    if (key == null) {

      kanban.closeInfoContatoConversa()

    }

  },

)



const mensagensOrdenadas = computed(() => [...mensagensItems.value].reverse())



const scroller = ref<HTMLElement | null>(null)

const isAtBottom = ref(true)

const isAtTop = ref(true)

const shouldScrollOnOpen = ref(false)



const TOP_THRESHOLD_PX = 80



function updateIsAtBottom() {

  const el = scroller.value

  if (!el) return

  const thresholdPx = 24

  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx

}



function updateIsAtTop() {

  const el = scroller.value

  if (!el) return

  isAtTop.value = el.scrollTop <= TOP_THRESHOLD_PX

}



function onScrollerScroll() {

  updateIsAtBottom()

  updateIsAtTop()

}



async function scrollToBottom() {

  await nextTick()

  const el = scroller.value

  if (!el) return

  el.scrollTop = el.scrollHeight

}



const showScrollDownFab = computed(() => {

  if (!activeKey.value) return false

  return !isAtBottom.value

})



async function onFabScrollToBottom() {

  await scrollToBottom()

  updateIsAtBottom()

  updateIsAtTop()

}



const showLoadMoreFab = computed(() => {

  if (!activeKey.value) return false

  if (!isAtTop.value) return false

  return mensagensHasMore.value

})



async function onLoadMoreMensagens() {

  const el = scroller.value

  if (!el || !mensagensHasMore.value || mensagensPending.value) return



  const prevHeight = el.scrollHeight

  const prevTop = el.scrollTop



  try {

    await mensagens.fetchNextPage()

  } catch {

    return

  }



  await nextTick()

  requestAnimationFrame(() => {

    const box = scroller.value

    if (!box) return

    const delta = box.scrollHeight - prevHeight

    box.scrollTop = prevTop + delta

    updateIsAtTop()

    updateIsAtBottom()

  })

}



watch(

  () => mensagensOrdenadas.value.length,

  async () => {

    if (shouldScrollOnOpen.value) {

      await scrollToBottom()

      updateIsAtBottom()

      updateIsAtTop()

      return

    }

    if (!isAtBottom.value) return

    await scrollToBottom()

    updateIsAtBottom()

    updateIsAtTop()

  },

  { flush: 'post' },

)

</script>



<template>

  <aside

    class="relative flex min-h-0 min-w-0 flex-1 flex-col border-l border-outline/30 bg-surface-container-lowest dark:border-dark-outline/30 dark:bg-dark-surface-container-low"

    aria-label="Chat"

  >

    <AreaChatHeader v-if="mostrarHeader" />



    <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">

      <div

        ref="scroller"

        class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 pl-10"

        @scroll="onScrollerScroll"

      >

        <div

          v-if="!activeKey"

          class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"

        >

          Selecione um contato para ver as mensagens.

        </div>



        <div

          v-else-if="idCanal == null"

          class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"

        >

          Conversa sem canal vinculado.

        </div>



        <div

          v-else-if="mensagensPending && mensagensOrdenadas.length === 0"

          class="flex items-center justify-center py-10"

        >

          <span

            class="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"

            aria-hidden="true"

          />

        </div>



        <div

          v-else-if="mensagensError && mensagensOrdenadas.length === 0"

          class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200"

        >

          {{ mensagensError }}

        </div>



        <div v-else class="flex min-h-full min-w-0 flex-col justify-end">

          <div class="flex min-w-0 flex-col">

            <BalaoMensagem

              v-for="m in mensagensOrdenadas"

              :key="m.temp_id ?? m.message_id"

              :mensagem="m"

              :eh-grupo="ehGrupo"

            />

          </div>

        </div>

      </div>



      <Transition name="fab-scroll">

        <button

          v-if="showScrollDownFab"

          type="button"

          class="absolute bottom-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-lg ring-1 ring-black/5 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-700"

          aria-label="Ir para a mensagem mais recente"

          @click="onFabScrollToBottom"

        >

          <span class="material-symbols-outlined text-[24px]" aria-hidden="true">expand_more</span>

        </button>

      </Transition>



      <Transition name="fab-load-top">

        <button

          v-if="showLoadMoreFab"

          type="button"

          class="absolute left-1/2 top-4 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-black/5 transition hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-700"

          :disabled="mensagensPending"

          aria-label="Carregar mensagens mais antigas"

          @click="onLoadMoreMensagens"

        >

          {{ mensagensPending ? 'Carregando…' : 'Carregar mais mensagens' }}

        </button>

      </Transition>

    </div>



    <ConversaRodape />

  </aside>

</template>



<style scoped>

.fab-scroll-enter-active,

.fab-scroll-leave-active {

  transition:

    opacity 0.2s ease,

    transform 0.2s ease;

}

.fab-scroll-enter-from,

.fab-scroll-leave-to {

  opacity: 0;

  transform: translateY(8px);

}



.fab-load-top-enter-active,

.fab-load-top-leave-active {

  transition: opacity 0.2s ease;

}

.fab-load-top-enter-from,

.fab-load-top-leave-to {

  opacity: 0;

}

</style>

