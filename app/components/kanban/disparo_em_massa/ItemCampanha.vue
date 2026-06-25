<script setup lang="ts">
import { computed } from 'vue'
import type { CampanhaListItem, CampanhaStatus } from '#shared/types/disparoEmMassa'
import BaseButton from '~/components/BaseButton.vue'

const props = defineProps<{
  campanha: CampanhaListItem
}>()

const emit = defineEmits<{
  editar: [campanhaId: string]
}>()

const statusLabel: Record<CampanhaStatus, string> = {
  rascunho: 'Rascunho',
  processando: 'Processando',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusExibicao = computed(() => {
  const s = props.campanha.status
  if (!s) return '—'
  return statusLabel[s] ?? s
})

const tipoMensagem = computed(() => props.campanha.tipo_mensagem ?? 'texto')

const exibeMidiaVisual = computed(
  () => tipoMensagem.value === 'imagem' || tipoMensagem.value === 'video',
)

const legendaExibicao = computed(() => {
  const texto = (props.campanha.conteudo_texto ?? '').trim()
  return texto || 'sem legenda'
})

const textoExibicao = computed(() => {
  const texto = (props.campanha.conteudo_texto ?? '').trim()
  return texto || '—'
})

const exibeProgressoEnvio = computed(() => {
  const s = props.campanha.status
  return s === 'rascunho' || s === 'processando' || s === 'pausado'
})

const totalEnviados = computed(() => {
  const n = props.campanha.total_enviados
  return n != null && Number.isFinite(n) ? n : 0
})

const totalContatos = computed(() => {
  const n = props.campanha.total_contatos
  return n != null && Number.isFinite(n) ? n : 0
})

function onEditar() {
  emit('editar', props.campanha.id)
}
</script>

<template>
  <article
    class="flex items-start gap-3 rounded-2xl border border-outline/30 bg-surface-container-lowest/90 p-4 shadow-sm dark:border-dark-outline/30 dark:bg-dark-surface-container-low/80"
  >
    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate text-sm font-bold text-on-surface dark:text-dark-on-surface">
          {{ campanha.nome }}
        </h3>
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          :class="
            campanha.status === 'processando'
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200'
              : campanha.status === 'concluido'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : campanha.status === 'pausado'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                  : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
          "
        >
          {{ statusExibicao }}
        </span>
      </div>

      <template v-if="exibeMidiaVisual">
        <div class="flex gap-3">
          <div
            v-if="campanha.url_midia"
            class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-outline/25 bg-surface-container-high dark:border-dark-outline/25 dark:bg-dark-surface-container-high"
          >
            <img
              v-if="tipoMensagem === 'imagem'"
              :src="campanha.url_midia"
              alt="Prévia da campanha"
              class="h-full w-full object-cover"
            />
            <video
              v-else
              :src="campanha.url_midia"
              class="h-full w-full object-cover"
              muted
              playsinline
              preload="metadata"
            />
          </div>
          <div
            v-else
            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline/35 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/35 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[22px]">
              {{ tipoMensagem === 'imagem' ? 'image' : 'videocam' }}
            </span>
          </div>

          <p
            class="min-w-0 flex-1 text-sm leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
            :class="legendaExibicao === 'sem legenda' ? 'italic opacity-80' : ''"
          >
            {{ legendaExibicao }}
          </p>
        </div>
      </template>

      <p
        v-else
        class="line-clamp-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ textoExibicao }}
      </p>

      <p class="text-xs text-on-surface-variant/80 dark:text-dark-on-surface-variant/80">
        Início: {{ formatarDataHora(campanha.data_inicio) }}
      </p>

      <p
        v-if="exibeProgressoEnvio"
        class="text-xs font-medium text-primary-700 dark:text-primary-300"
      >
        Enviados: {{ totalEnviados }} / {{ totalContatos }} contato(s)
      </p>
    </div>

    <BaseButton variant="secondary" :block="false" class="shrink-0" @click="onEditar">
      <span class="inline-flex items-center gap-1.5 text-xs font-semibold">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
        Editar
      </span>
    </BaseButton>
  </article>
</template>
