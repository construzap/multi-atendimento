<script setup lang="ts">
import { computed } from 'vue'
import BaseAvatar from '~/components/BaseAvatar.vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import type { InfoContatoConversaData } from '#shared/types/infoContatoConversa'

const props = withDefaults(
  defineProps<{
    open: boolean
    contato: InfoContatoConversaData | null
    /** Sem overlay próprio; pensado para uso lado a lado (ex.: kanban + chat). */
    embedded?: boolean
  }>(),
  {
    embedded: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const titleDisplay = computed(() => {
  const c = props.contato
  if (!c) return 'Contato'
  const n = c.name?.trim()
  if (n) return n
  const ph = c.phone?.trim()
  if (ph) return ph
  return c.conversa_key
})

function initials(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return `${a}${b}`.toUpperCase()
}

function priorityUi(p: number | null | undefined): { dot: string; text: string; pill: string } | null {
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

const prioridadeBadge = computed(() => priorityUi(props.contato?.prioridade))

const updatedAtLabel = computed(() => {
  const iso = props.contato?.updated_at
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function fechar() {
  isOpen.value = false
}
</script>

<template>
  <BaseModal
    v-if="!embedded"
    v-model:open="isOpen"
    title="Informações do contato"
    panel-class="w-full max-w-md"
  >
    <template v-if="contato" #subtitle>
      Detalhes da conversa
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">person</span>
    </template>

    <div v-if="contato" class="space-y-5">
      <div class="flex items-start gap-4">
        <BaseAvatar
          :src="contato.photo ?? null"
          :alt="titleDisplay"
          :text="initials(titleDisplay)"
          :size="56"
          variant="circle"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1">
          <h3 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
            {{ titleDisplay }}
          </h3>
          <p class="mt-1 font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ contato.phone?.trim() || '—' }}
          </p>
          <div v-if="prioridadeBadge" class="mt-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
              :class="prioridadeBadge.pill"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="prioridadeBadge.dot" aria-hidden="true" />
              Prioridade {{ prioridadeBadge.text }}
            </span>
          </div>
        </div>
      </div>

      <dl class="space-y-3 rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40">
        <div v-if="contato.etapa_nome" class="flex flex-col gap-0.5">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Etapa do funil
          </dt>
          <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
            {{ contato.etapa_nome }}
          </dd>
        </div>

        <div v-if="contato.canal_nome" class="flex flex-col gap-0.5">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Canal
          </dt>
          <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
            {{ contato.canal_nome }}
          </dd>
        </div>

        <div v-if="contato.preview" class="flex flex-col gap-0.5">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Última mensagem
          </dt>
          <dd class="text-sm leading-relaxed text-on-surface dark:text-dark-on-surface">
            {{ contato.preview }}
          </dd>
        </div>

        <div v-if="updatedAtLabel" class="flex flex-col gap-0.5">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Atualizado em
          </dt>
          <dd class="text-sm text-on-surface dark:text-dark-on-surface">
            {{ updatedAtLabel }}
          </dd>
        </div>

        <div class="flex flex-col gap-0.5">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Chave da conversa
          </dt>
          <dd class="break-all font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ contato.conversa_key }}
          </dd>
        </div>
      </dl>

      <slot />
    </div>

    <p v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Contato não encontrado.
    </p>

    <template #footer>
      <div class="w-full sm:w-32">
        <BaseButton type="button" variant="secondary" @click="fechar">
          Fechar
        </BaseButton>
      </div>
    </template>
  </BaseModal>

  <div
    v-else
    class="flex min-h-0 w-full max-w-md shrink-0 flex-col overflow-hidden border-r border-outline/30 dark:border-dark-outline/30"
  >
    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-outline/30 p-5 dark:border-dark-outline/30">
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-primary"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">person</span>
        </div>
        <div>
          <h2 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Informações do contato
          </h2>
          <p v-if="contato" class="mt-0.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Detalhes da conversa
          </p>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        aria-label="Fechar"
        @click="fechar"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-5">
      <div v-if="contato" class="space-y-5">
        <div class="flex items-start gap-4">
          <BaseAvatar
            :src="contato.photo ?? null"
            :alt="titleDisplay"
            :text="initials(titleDisplay)"
            :size="56"
            variant="circle"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <h3 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
              {{ titleDisplay }}
            </h3>
            <p class="mt-1 font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ contato.phone?.trim() || '—' }}
            </p>
            <div v-if="prioridadeBadge" class="mt-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                :class="prioridadeBadge.pill"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="prioridadeBadge.dot" aria-hidden="true" />
                Prioridade {{ prioridadeBadge.text }}
              </span>
            </div>
          </div>
        </div>

        <dl class="space-y-3 rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40">
          <div v-if="contato.etapa_nome" class="flex flex-col gap-0.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Etapa do funil
            </dt>
            <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
              {{ contato.etapa_nome }}
            </dd>
          </div>

          <div v-if="contato.canal_nome" class="flex flex-col gap-0.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Canal
            </dt>
            <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
              {{ contato.canal_nome }}
            </dd>
          </div>

          <div v-if="contato.preview" class="flex flex-col gap-0.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Última mensagem
            </dt>
            <dd class="text-sm leading-relaxed text-on-surface dark:text-dark-on-surface">
              {{ contato.preview }}
            </dd>
          </div>

          <div v-if="updatedAtLabel" class="flex flex-col gap-0.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Atualizado em
            </dt>
            <dd class="text-sm text-on-surface dark:text-dark-on-surface">
              {{ updatedAtLabel }}
            </dd>
          </div>

          <div class="flex flex-col gap-0.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Chave da conversa
            </dt>
            <dd class="break-all font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ contato.conversa_key }}
            </dd>
          </div>
        </dl>

        <slot />
      </div>

      <p v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Contato não encontrado.
      </p>
    </div>

    <footer class="shrink-0 border-t border-outline/30 p-5 dark:border-dark-outline/30">
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <div class="w-full sm:w-32">
          <BaseButton type="button" variant="secondary" @click="fechar">
            Fechar
          </BaseButton>
        </div>
      </div>
    </footer>
  </div>
</template>
