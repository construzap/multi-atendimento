<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import type { Canal } from '#shared/types/canal'
import BaseAvatar from '~/components/BaseAvatar.vue'

type CanalStatus = 'ativo' | 'pausado'

const props = defineProps<{
  workspaceId: number
  canal: Canal
  /** Texto já formatado, ex.: "Criado em 12/10/2023" */
  dataCriacaoLabel: string
  status: CanalStatus
  /** Foto da instância (opcional) */
  avatarSrc?: string | null
}>()

const canaisStore = useCanaisStore()

function abrirChat() {
  canaisStore.setCurrentCanal(props.canal)
  navigateTo(`/workspaces/${props.workspaceId}/chat/${props.canal.id}`)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    abrirChat()
  }
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center"
    @click="abrirChat"
    @keydown="onKeydown"
  >
    <div class="flex min-w-0 flex-1 items-start gap-4">
      <BaseAvatar
        :src="avatarSrc ?? null"
        :size="56"
        variant="rounded"
        class="shrink-0"
        fallback-class="bg-[#25D366] text-white shadow-sm"
      >
        <template #fallback>
          <FontAwesomeIcon :icon="faWhatsapp" class="h-8 w-8" />
        </template>
      </BaseAvatar>

      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-slate-900 dark:text-white">
          {{ canal.nome ?? '' }}
        </h3>
        <p class="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {{ canal.descricao ?? '' }}
        </p>
      </div>
    </div>

    <div
      class="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0 dark:border-slate-800 md:justify-end md:gap-6"
    >
      <span
        class="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary"
      >
        <span class="size-2 animate-pulse rounded-full bg-primary" />
        {{ status === 'ativo' ? 'Ativo' : 'Pausado' }}
      </span>

      <div
        class="text-right text-[11px] leading-tight text-slate-400 tabular-nums dark:text-slate-500"
      >
        <p class="font-mono">#{{ canal.id }}</p>
        <p class="mt-1 max-w-[11rem] truncate sm:max-w-none">
          {{ dataCriacaoLabel }}
        </p>
      </div>
    </div>
  </div>
</template>
