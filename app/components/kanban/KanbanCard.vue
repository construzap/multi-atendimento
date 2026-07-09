<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseAvatar from '~/components/BaseAvatar.vue'
import type { KanbanCard as KanbanCardModel } from '#shared/types/kanban'

const props = defineProps<{
  card: KanbanCardModel
  columnId: number | string
  draggingId?: string | null
  selected?: boolean
  forceShowCheckbox?: boolean
}>()

const emit = defineEmits<{
  cardDragStart: [payload: { cardId: string; fromColumnId: string }]
  cardDragEnd: []
  cardOpen: [card: KanbanCardModel]
  cardToggleSelected: [payload: { conversa_key: string; nextSelected: boolean }]
}>()

let lastDragEndAt = 0

const titleDisplay = computed(() => {
  const n = props.card.name?.trim()
  if (n) return n
  const ph = props.card.phone?.trim()
  if (ph) return ph
  return props.card.conversa_key
})

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  const col = String(props.columnId)
  e.dataTransfer.setData('text/plain', `${col}::${props.card.conversa_key}`)
  emit('cardDragStart', { cardId: props.card.conversa_key, fromColumnId: col })
}

/** Sem preventDefault no card sob o cursor, o browser bloqueia o drop na coluna. */
function onDragOverCard(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDragEnd() {
  lastDragEndAt = Date.now()
  emit('cardDragEnd')
}

function onCardClick() {
  if (Date.now() - lastDragEndAt < 250) return
  emit('cardOpen', props.card)
}

function onToggleSelected(e: Event) {
  e.stopPropagation()
  const key = props.card.conversa_key?.trim()
  if (!key) return
  const nextSelected = !(props.selected === true)
  emit('cardToggleSelected', { conversa_key: key, nextSelected })
}

function initials(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return `${a}${b}`.toUpperCase()
}

/** 1=baixa, 2=média, 3=alta — outros/null → sem badge. */
function priorityUi(p: number | null): { dot: string; text: string; pill: string } | null {
  if (p == null || !Number.isFinite(p)) return null
  if (p === 3) {
    return {
      dot: 'bg-rose-500',
      text: 'Alta',
      pill: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-900/20 dark:border-rose-800/40',
    }
  }
  if (p === 2) {
    return {
      dot: 'bg-amber-500',
      text: 'Média',
      pill: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40',
    }
  }
  if (p === 1) {
    return {
      dot: 'bg-sky-500',
      text: 'Baixa',
      pill: 'text-sky-800 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-900/20 dark:border-sky-800/40',
    }
  }
  return null
}

const canalNomeBadge = computed(() => props.card.canal_nome?.trim() ?? '')

const temNaoLidas = computed(() => (props.card.nao_lidas ?? 0) >= 1)

const naoLidasLabel = computed(() => {
  const n = props.card.nao_lidas ?? 0
  if (n < 1) return ''
  return n > 99 ? '99+' : String(n)
})

const timeLabel = computed(() => {
  const iso = props.card.updated_at
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  if (sec < 60) return 'agora'
  if (min < 60) return `${min} min`
  if (hr < 24) return `${hr} h`
  if (day < 7) return `${day} d`

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
})
</script>

<template>
  <article
    class="group relative cursor-pointer rounded-2xl border border-outline/40 bg-white p-4 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    :class="draggingId === card.conversa_key ? 'opacity-60 ring-2 ring-primary/25' : ''"
    draggable="true"
    role="button"
    tabindex="0"
    :aria-label="`Ver informações de ${titleDisplay}`"
    @click="onCardClick"
    @keydown.enter.prevent="onCardClick"
    @keydown.space.prevent="onCardClick"
    @dragstart="onDragStart"
    @dragover="onDragOverCard"
    @dragend="onDragEnd"
  >
    <label
      class="absolute right-3 top-3 z-10"
      :class="
        props.forceShowCheckbox || props.selected
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100'
      "
      :title="props.selected ? 'Remover da seleção' : 'Selecionar'"
      @click.stop
      @mousedown.stop
    >
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="props.selected === true"
        @change="onToggleSelected"
      />
      <span
        class="flex h-8 w-8 items-center justify-center rounded-xl border border-outline/45 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-50 dark:border-dark-outline/45 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-900"
        :class="props.selected ? 'ring-2 ring-primary/25' : ''"
        aria-hidden="true"
      >
        <span
          class="flex h-4 w-4 items-center justify-center rounded-md border-2 transition-colors"
          :class="
            props.selected
              ? 'border-primary bg-primary text-white'
              : 'border-slate-300 bg-transparent dark:border-slate-600'
          "
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            :class="props.selected ? 'opacity-100' : 'opacity-0'"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42-.002l-3.25-3.29a1 1 0 1 1 1.422-1.406l2.54 2.57 6.54-6.59a1 1 0 0 1 1.412-.006Z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
      </span>
      <span class="sr-only">Selecionar card</span>
    </label>

    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <BaseAvatar
          :src="card.photo ?? null"
          :alt="titleDisplay"
          :text="initials(titleDisplay)"
          :size="40"
          variant="circle"
          class="shrink-0"
        />
        <div class="min-w-0">
          <h3 class="truncate font-headline text-sm font-bold text-slate-900 dark:text-dark-on-surface">
            {{ titleDisplay }}
          </h3>
          <p class="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-dark-on-surface-variant">
            {{ card.phone ?? '—' }}
          </p>
        </div>
      </div>

      <div v-if="priorityUi(card.prioridade)" class="shrink-0">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          :class="priorityUi(card.prioridade)!.pill"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="priorityUi(card.prioridade)!.dot" aria-hidden="true" />
          {{ priorityUi(card.prioridade)!.text }}
        </span>
      </div>
    </div>

    <p
      v-if="card.preview || temNaoLidas"
      class="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-dark-on-surface-variant"
    >
      <span v-if="card.preview" class="min-w-0 flex-1 line-clamp-2">{{ card.preview }}</span>
      <span
        v-if="temNaoLidas"
        class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm"
        :class="card.preview ? '' : 'ml-auto'"
        :aria-label="`${naoLidasLabel} mensagem${(card.nao_lidas ?? 0) === 1 ? '' : 's'} não lida${(card.nao_lidas ?? 0) === 1 ? '' : 's'}`"
      >
        {{ naoLidasLabel }}
      </span>
    </p>

    <div class="mt-4 flex items-center justify-between gap-2">
      <div v-if="canalNomeBadge" class="min-w-0 flex-1">
        <span
          class="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-900/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-50 shadow-sm dark:bg-emerald-950 dark:text-emerald-100"
          :title="canalNomeBadge"
        >
          <svg
            class="h-3.5 w-3.5 shrink-0 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
            />
          </svg>
          <span class="truncate">{{ canalNomeBadge }}</span>
        </span>
      </div>

      <span
        class="shrink-0 text-[11px] text-slate-400 dark:text-dark-on-surface-variant"
        :class="canalNomeBadge ? '' : 'ml-auto'"
      >
        {{ timeLabel }}
      </span>
    </div>
  </article>
</template>
