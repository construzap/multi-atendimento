<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))
const filename = computed(() => (props.mensagem.filename ?? '').trim())
const caption = computed(() => (props.mensagem.caption ?? '').trim())
const url = computed(() => (props.mensagem.media_url ?? '').trim())

function extFromName(name: string, fallbackUrl: string): string {
  const base = (name || '').trim()
  const fromName = base.includes('.') ? base.split('.').pop() : ''
  const cleanFromName = (fromName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (cleanFromName) return cleanFromName

  const u = (fallbackUrl || '').split('?')[0] ?? ''
  const fromUrl = u.includes('.') ? u.split('.').pop() : ''
  return (fromUrl ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const ext = computed(() => extFromName(filename.value, url.value))
const labelExt = computed(() => (ext.value ? ext.value.toUpperCase() : 'ARQ'))
const isImageDoc = computed(() => ext.value === 'jpg' || ext.value === 'jpeg' || ext.value === 'png' || ext.value === 'webp' || ext.value === 'gif')

const fileIcon = computed(() => {
  switch (ext.value) {
    case 'pdf':
      return 'picture_as_pdf'
    case 'doc':
    case 'docx':
      return 'description'
    case 'txt':
      return 'article'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'gif':
      return 'image'
    default:
      return 'draft'
  }
})

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-3 shadow-sm dark:bg-slate-800">
      <div class="flex items-start gap-3">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container dark:bg-slate-700"
        >
          <img
            v-if="isImageDoc && url"
            :src="url"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span v-else class="material-symbols-outlined text-[22px] text-on-surface-variant dark:text-slate-200" aria-hidden="true">
            {{ fileIcon }}
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate font-body text-sm font-semibold text-on-surface dark:text-slate-100">
            {{ filename || 'documento' }}
          </p>
          <p class="mt-0.5 text-[10px] text-on-surface-variant dark:text-slate-400">
            {{ labelExt }}
          </p>
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/20 pt-2 dark:border-slate-700/60">
        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold text-on-surface hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Abrir
        </a>
        <span v-else class="px-3 py-2 text-[11px] text-on-surface-variant dark:text-slate-400">Sem link</span>

        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          download
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold text-primary hover:bg-surface-container dark:hover:bg-slate-700"
          aria-label="Salvar documento"
        >
          Salvar como...
        </a>
      </div>

      <p v-if="caption" class="mt-2 font-body text-sm text-on-surface dark:text-slate-200">
        {{ caption }}
      </p>

      <span class="mt-1 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-3 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/10">
          <img
            v-if="isImageDoc && url"
            :src="url"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span v-else class="material-symbols-outlined text-[22px] text-on-primary-container" aria-hidden="true">
            {{ fileIcon }}
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate font-body text-sm font-semibold text-on-primary-container">
            {{ filename || 'documento' }}
          </p>
          <p class="mt-0.5 text-[10px] text-on-primary-container/80">
            {{ labelExt }}
          </p>
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between gap-2 border-t border-black/10 pt-2">
        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold text-on-primary-container hover:bg-black/5"
        >
          Abrir
        </a>
        <span v-else class="px-3 py-2 text-[11px] text-on-primary-container/70">Sem link</span>

        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          download
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold text-on-primary-container hover:bg-black/5"
          aria-label="Salvar documento"
        >
          Salvar como...
        </a>
      </div>

      <p v-if="caption" class="mt-2 font-body text-sm text-on-primary-container">
        {{ caption }}
      </p>

      <div class="mt-1 flex items-center justify-end gap-1">
        <span class="text-[10px] text-on-primary-container/80">
          {{ hora }}<span v-if="isSending"> · enviando…</span>
        </span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          {{ isSending ? 'done' : 'done_all' }}
        </span>
      </div>
    </div>
  </div>
</template>

