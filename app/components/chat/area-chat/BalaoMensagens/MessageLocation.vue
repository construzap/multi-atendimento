<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{
  mensagem: Mensagem
}>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))

const isLive = computed(() => props.mensagem.messagetype === 'liveLocationMessage')

const titulo = computed(() =>
  isLive.value ? 'Localização em tempo real' : 'Localização'
)

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

const hora = computed(() => formatHora(props.mensagem.created_at))
</script>

<template>
  <!-- recebida -->
  <div v-if="!isFromMe" class="mb-4 flex max-w-[85%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-4 shadow-sm dark:bg-slate-800">
      <p class="mb-2 font-body text-xs font-semibold text-on-surface dark:text-slate-200">
        {{ titulo }}
      </p>
      <p class="font-body text-sm leading-relaxed text-on-surface dark:text-slate-200">
        Esta mensagem é uma localização. Para ver no mapa, abra esta conversa no
        <span class="font-medium">WhatsApp</span>.
      </p>
      <span class="mt-2 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <!-- enviada -->
  <div v-else class="mb-4 ml-auto flex max-w-[85%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-4 shadow-sm">
      <p class="mb-2 font-body text-xs font-semibold text-on-primary-container">
        {{ titulo }}
      </p>
      <p class="font-body text-sm leading-relaxed text-on-primary-container">
        Esta mensagem é uma localização. Para ver no mapa, abra esta conversa no
        <span class="font-medium">WhatsApp</span>.
      </p>
      <div class="mt-2 flex justify-end">
        <span class="text-[10px] text-on-primary-container/80">{{ hora }}</span>
      </div>
    </div>
  </div>
</template>
