<script setup lang="ts">
import { computed } from 'vue'
import BaseAvatar from '../../BaseAvatar.vue'
import Nome from './Nome.vue'
import Telefone from './Telefone.vue'
import Canal from './Canal.vue'
import Switch from './Switch.vue'
import type { InfoContatoConversaData } from '#shared/types/infoContatoConversa'

const props = defineProps<{
  contato: InfoContatoConversaData
  conversaEditavel?: boolean
  /** @deprecated use conversaEditavel */
  nomeEditavel?: boolean
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  nomeSalvo: [name: string | null]
}>()

function propEditavelAtivo(v: boolean | undefined): boolean {
  return v === true || (v as unknown) === ''
}

const editavel = computed(
  () => propEditavelAtivo(props.conversaEditavel) || propEditavelAtivo(props.nomeEditavel),
)

const titleDisplay = computed(() => {
  const c = props.contato
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

const prioridadeBadge = computed(() => priorityUi(props.contato.prioridade))

const updatedAtLabel = computed(() => {
  const iso = props.contato.updated_at
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

const mostrarCanal = computed(
  () => editavel.value || !!props.contato.canal_nome?.trim() || props.contato.id_canal != null,
)
</script>

<template>
  <div class="space-y-5">
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
        <Nome
          :conversa-key="contato.conversa_key"
          :name="contato.name"
          :phone="contato.phone"
          :conversa-editavel="editavel"
          :workspace-id="workspaceId"
          @nome-salvo="emit('nomeSalvo', $event)"
        />
        <Telefone
          :conversa-key="contato.conversa_key"
          :phone="contato.phone"
          :conversa-editavel="editavel"
          :workspace-id="workspaceId"
        />
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
      <slot name="etapa-funil" />

      <Canal
        v-if="mostrarCanal"
        :id-canal="contato.id_canal ?? null"
        :canal-nome="contato.canal_nome"
      />

      <Switch
        v-if="editavel || contato.conversa_aberta != null"
        :conversa-key="contato.conversa_key"
        campo="conversa_aberta"
        label="Conversa aberta"
        :valor="contato.conversa_aberta ?? null"
        :conversa-editavel="editavel"
        :workspace-id="workspaceId"
        mensagem-sucesso="Status da conversa atualizado."
      />

      <Switch
        v-if="editavel || contato.ia_ligada != null"
        :conversa-key="contato.conversa_key"
        campo="ia_ligada"
        label="I.A. ligada"
        :valor="contato.ia_ligada ?? null"
        :conversa-editavel="editavel"
        :workspace-id="workspaceId"
        mensagem-sucesso="I.A. atualizada."
      />

      <div v-if="updatedAtLabel" class="flex flex-col gap-0.5">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Atualizado em
        </dt>
        <dd class="text-sm text-on-surface dark:text-dark-on-surface">
          {{ updatedAtLabel }}
        </dd>
      </div>
    </dl>

    <slot />
  </div>
</template>
