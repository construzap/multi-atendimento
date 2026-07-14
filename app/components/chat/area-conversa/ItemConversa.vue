<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseAvatar from '~/components/BaseAvatar.vue'
import SelecaoMultiplaBar from '~/components/kanban/SelecaoMultiplaBar.vue'
import type { MessageType } from '#shared/types/messageType'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'

const props = withDefaults(
  defineProps<{
    /** Chave/ID da conversa (ex.: phone ou lid). */
    conversaId: string
    nome: string
    ultimaMensagem: string
    horario: string
    avatarSrc?: string | null
    alt?: string
    selected?: boolean
    multiSelected?: boolean
    forceShowCheckbox?: boolean
    messatype?: MessageType | null
  fechada?: boolean
  isGrupo?: boolean
  naoLidas?: number
  }>(),
  {
    avatarSrc: null,
    alt: '',
    selected: false,
    multiSelected: false,
    forceShowCheckbox: false,
    messatype: null,
    fechada: false,
    isGrupo: false,
    naoLidas: 0,
  }
)

const emit = defineEmits<{
  select: []
  toggleSelected: [payload: { conversaKey: string; nextSelected: boolean }]
}>()

const route = useRoute()
const conversasStore = useConversasStore()
const kanbanStore = useKanbanStore()
const workspacesStore = useWorkspacesStore()
const { funis, funisPending } = storeToRefs(kanbanStore)

const modalStatusAberto = ref(false)

function parseWorkspaceId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

const workspaceId = computed(() => {
  const fromStore = parseWorkspaceId(workspacesStore.currentWorkspaceId)
  if (fromStore) return fromStore
  return parseWorkspaceId(route.params.id)
})

const podeAlterarStatus = computed(() => workspaceId.value != null)

const colunaId = computed(() => {
  const key = props.conversaId.trim()
  if (!key) return null
  const conv = conversasStore.findConversaByKey(key)
  return conv?.coluna_id ?? null
})

function corDot(cor: string | null | undefined): string {
  const c = cor?.trim()
  return c || '#94a3b8'
}

const statusColuna = computed(() => {
  const id = colunaId.value
  if (id == null || id < 1) return null

  if (funisPending.value && funis.value.length === 0) {
    return { nome: 'Carregando…', cor: '#94a3b8', loading: true as const }
  }

  for (const funil of funis.value) {
    const coluna = funil.columns?.find((c) => c.id === id)
    if (coluna) {
      return {
        nome: coluna.nome?.trim() || `Coluna #${id}`,
        cor: corDot(coluna.cor),
        loading: false as const,
      }
    }
  }

  return { nome: `Coluna #${id}`, cor: '#94a3b8', loading: false as const }
})

function abrirAlterarStatus(e: Event) {
  e.stopPropagation()
  const wsId = workspaceId.value
  if (!wsId) return
  void kanbanStore.ensureFunisLoaded(wsId).catch(() => {})
  modalStatusAberto.value = true
}

function emojiByType(t: MessageType | null | undefined): string {
  if (!t || t === 'conversation') return ''
  switch (t) {
    case 'audioMessage':
      return '🎧'
    case 'imageMessage':
      return '🖼️'
    case 'videoMessage':
      return '🎥'
    case 'documentMessage':
    case 'documentWithCaptionMessage':
      return '📄'
    case 'stickerMessage':
    case 'lottieStickerMessage':
      return '🧩'
    case 'locationMessage':
    case 'liveLocationMessage':
      return '📍'
    case 'contactMessage':
    case 'contactsArrayMessage':
      return '👤'
    case 'reactionMessage':
      return '❤️'
    case 'buttonsMessage':
    case 'listMessage':
    case 'interactiveMessage':
    case 'templateMessage':
    case 'templateButtonReplyMessage':
      return '🧭'
    case 'orderMessage':
    case 'productMessage':
      return '🛒'
    case 'groupInviteMessage':
      return '👥'
    case 'editedMessage':
      return '✏️'
    case 'ephemeralMessage':
    case 'viewOnceMessage':
      return '⏳'
    case 'pinInChatMessage':
      return '📌'
    case 'placeholderMessage':
    case 'unknown':
    case 'desconhecido':
    case 'ptvMessage':
    case 'associatedChildMessage':
    case 'extendedTextMessage':
      return '💬'
  }
}

const preview = computed(() => {
  const emoji = emojiByType(props.messatype)
  if (!emoji) return props.ultimaMensagem
  return `${emoji} ${props.ultimaMensagem}`.trim()
})

const temNaoLidas = computed(() => (props.naoLidas ?? 0) >= 1)

const naoLidasLabel = computed(() => {
  const n = props.naoLidas ?? 0
  if (n < 1) return ''
  return n > 99 ? '99+' : String(n)
})

function onToggleSelected(e: Event) {
  e.stopPropagation()
  const key = props.conversaId?.trim()
  if (!key) return
  const nextSelected = !(props.multiSelected === true)
  emit('toggleSelected', { conversaKey: key, nextSelected })
}

function onSelect() {
  emit('select')

  const workspaceId = String(route.params.id ?? '')
  const canalId = route.params.canalId
  if (!workspaceId || !canalId) return

  const cid = Number.parseInt(String(canalId), 10)
  if (!Number.isFinite(cid) || cid < 1) return

  void navegarParaConversaChat(workspaceId, cid, props.conversaId)
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-3 pr-11 shadow-sm transition-all dark:bg-slate-800"
    :class="
      props.selected
        ? 'border-primary/30 ring-1 ring-primary/20 dark:border-primary/40'
        : props.fechada
          ? 'border-slate-200 opacity-75 dark:border-slate-700'
          : 'border-orange-100 dark:border-orange-900/30'
    "
    @click="onSelect"
  >
    <span
      v-if="props.selected"
      class="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-primary"
      aria-hidden="true"
    />
    <BaseAvatar
      :image-url="avatarSrc ?? undefined"
      :alt="alt || nome"
      :size="48"
      variant="circle"
    />

    <div class="min-w-0 flex-1">
      <div class="mb-0.5 flex items-baseline justify-between">
        <h3 class="truncate font-headline text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h3>
        <div class="flex shrink-0 items-center gap-1.5">
          <span
            v-if="props.isGrupo"
            class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary dark:bg-primary/20"
          >
            Grupo
          </span>
          <span
            v-if="props.fechada"
            class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          >
            Fechada
          </span>
          <span class="text-[10px] text-on-surface-variant dark:text-slate-400">{{ horario }}</span>
        </div>
      </div>
      <div v-if="podeAlterarStatus" class="mb-0.5">
        <button
          v-if="statusColuna"
          type="button"
          class="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold transition-opacity hover:opacity-80"
          :class="statusColuna.loading ? 'cursor-default border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300' : 'cursor-pointer'"
          :style="
            statusColuna.loading
              ? undefined
              : {
                  borderColor: `${statusColuna.cor}55`,
                  backgroundColor: `${statusColuna.cor}14`,
                  color: statusColuna.cor,
                }
          "
          :title="statusColuna.loading ? undefined : `Alterar status: ${statusColuna.nome}`"
          :disabled="statusColuna.loading"
          @click="abrirAlterarStatus"
        >
          <span
            v-if="!statusColuna.loading"
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :style="{ backgroundColor: statusColuna.cor }"
            aria-hidden="true"
          />
          <span class="truncate">{{ statusColuna.nome }}</span>
        </button>
        <button
          v-else
          type="button"
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-slate-300/80 bg-slate-50/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-primary-300"
          title="Definir status no kanban"
          @click="abrirAlterarStatus"
        >
          Sem status
        </button>
      </div>
      <p class="flex items-center gap-2 font-body text-xs text-on-surface-variant dark:text-slate-400">
        <span class="min-w-0 flex-1 truncate">{{ preview }}</span>
        <span
          v-if="temNaoLidas"
          class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm"
          :aria-label="`${naoLidasLabel} mensagem${(props.naoLidas ?? 0) === 1 ? '' : 's'} não lida${(props.naoLidas ?? 0) === 1 ? '' : 's'}`"
        >
          {{ naoLidasLabel }}
        </span>
      </p>
    </div>

    <label
      class="absolute right-2 top-1/2 z-10 -translate-y-1/2"
      :class="
        props.forceShowCheckbox || props.multiSelected
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100'
      "
      :title="props.multiSelected ? 'Remover da seleção' : 'Selecionar'"
      @click.stop
      @mousedown.stop
    >
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="props.multiSelected === true"
        @change="onToggleSelected"
      />
      <span
        class="flex h-8 w-8 items-center justify-center rounded-xl border border-outline/45 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-50 dark:border-dark-outline/45 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-900"
        :class="props.multiSelected ? 'ring-2 ring-primary/25' : ''"
        aria-hidden="true"
      >
        <span
          class="flex h-4 w-4 items-center justify-center rounded-md border-2 transition-colors"
          :class="
            props.multiSelected
              ? 'border-primary bg-primary text-white'
              : 'border-slate-300 bg-transparent dark:border-slate-600'
          "
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            :class="props.multiSelected ? 'opacity-100' : 'opacity-0'"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42-.002l-3.25-3.29a1 1 0 1 1 1.422-1.406l2.54 2.57 6.54-6.59a1 1 0 0 1 1.412-.006Z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
      </span>
      <span class="sr-only">Selecionar conversa</span>
    </label>

    <SelecaoMultiplaBar
      v-if="modalStatusAberto && workspaceId"
      v-model:modal-open="modalStatusAberto"
      :show-bar="false"
      :count="1"
      :workspace-id="workspaceId"
      :funil-id="0"
      :selected-keys="[conversaId]"
      :coluna-inicial-id="colunaId"
      @concluido="modalStatusAberto = false"
    />
  </div>
</template>
