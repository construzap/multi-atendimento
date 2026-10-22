<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

type TipoArquivo = 'imagem' | 'pdf' | 'video'

type ArquivoLocal = {
  id: string
  nome: string
  tipo: TipoArquivo
  tamanho: string
  previewUrl: string | null
}

const props = withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const inputRef = ref<HTMLInputElement | null>(null)
const arrastando = ref(false)
const arquivos = ref<ArquivoLocal[]>([])
const aviso = ref<string | null>(null)
let dragProfundidade = 0

function tipoDoArquivo(file: File): TipoArquivo | null {
  const nome = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(nome)) return 'imagem'
  if (file.type === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/.test(nome)) return 'video'
  return null
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconeDoTipo(tipo: TipoArquivo): string {
  if (tipo === 'pdf') return 'picture_as_pdf'
  if (tipo === 'video') return 'movie'
  return 'image'
}

function rotuloDoTipo(tipo: TipoArquivo): string {
  if (tipo === 'pdf') return 'PDF'
  if (tipo === 'video') return 'Vídeo'
  return 'Imagem'
}

function adicionarArquivos(lista: FileList | File[]) {
  if (props.disabled) return
  const ignorados: string[] = []
  const proximos = [...arquivos.value]

  for (const file of Array.from(lista)) {
    const tipo = tipoDoArquivo(file)
    if (!tipo) {
      ignorados.push(file.name)
      continue
    }
    const previewUrl = tipo === 'imagem' ? URL.createObjectURL(file) : null
    proximos.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${proximos.length}`,
      nome: file.name,
      tipo,
      tamanho: formatarTamanho(file.size),
      previewUrl,
    })
  }

  arquivos.value = proximos
  aviso.value = ignorados.length
    ? 'Só entram imagem, PDF e vídeo.'
    : null
}

function abrirSeletor() {
  if (props.disabled) return
  inputRef.value?.click()
}

function aoEscolher(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) adicionarArquivos(input.files)
  input.value = ''
}

function onDragEnter(event: DragEvent) {
  if (props.disabled) return
  event.preventDefault()
  dragProfundidade += 1
  arrastando.value = true
}

function onDragOver(event: DragEvent) {
  if (props.disabled) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  dragProfundidade = Math.max(0, dragProfundidade - 1)
  if (dragProfundidade === 0) arrastando.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragProfundidade = 0
  arrastando.value = false
  if (props.disabled) return
  const files = event.dataTransfer?.files
  if (files?.length) adicionarArquivos(files)
}

function remover(id: string) {
  const item = arquivos.value.find((arquivo) => arquivo.id === id)
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
  arquivos.value = arquivos.value.filter((arquivo) => arquivo.id !== id)
}

onUnmounted(() => {
  for (const arquivo of arquivos.value) {
    if (arquivo.previewUrl) URL.revokeObjectURL(arquivo.previewUrl)
  }
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
        Arquivos
      </p>
      <p
        v-if="arquivos.length"
        class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ arquivos.length }} {{ arquivos.length === 1 ? 'arquivo' : 'arquivos' }}
      </p>
    </div>

    <div
      class="rounded-xl border-2 border-dashed p-4 text-center transition-colors"
      :class="
        disabled
          ? 'cursor-not-allowed border-outline/25 opacity-60 dark:border-dark-outline/25'
          : arrastando
            ? 'cursor-copy border-primary-500 bg-primary-500/8 dark:border-primary-400 dark:bg-primary-500/12'
            : 'cursor-pointer border-outline/40 bg-surface-container-lowest/60 hover:border-outline/55 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest/50 dark:hover:border-dark-outline/55'
      "
      role="button"
      tabindex="0"
      :aria-disabled="disabled"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="abrirSeletor"
      @keydown.enter.prevent="abrirSeletor"
      @keydown.space.prevent="abrirSeletor"
    >
      <input
        ref="inputRef"
        type="file"
        accept="image/*,application/pdf,video/*"
        multiple
        class="sr-only"
        :disabled="disabled"
        @change="aoEscolher"
      >
      <span
        class="material-symbols-outlined mx-auto mb-1.5 block text-[32px] text-primary-600 dark:text-primary-400"
        aria-hidden="true"
      >
        {{ arrastando ? 'download' : 'cloud_upload' }}
      </span>
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Arraste imagens, PDFs ou vídeos
      </p>
      <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        ou clique para escolher · vários arquivos
      </p>
    </div>

    <p
      v-if="aviso"
      class="text-xs text-amber-700 dark:text-amber-300"
      role="status"
    >
      {{ aviso }}
    </p>

    <ul
      v-if="arquivos.length"
      class="max-h-48 space-y-1.5 overflow-y-auto"
      role="list"
    >
      <li
        v-for="arquivo in arquivos"
        :key="arquivo.id"
        class="flex items-center gap-2.5 rounded-lg border border-outline/25 bg-surface px-2 py-1.5 dark:border-dark-outline/25 dark:bg-dark-surface"
      >
        <img
          v-if="arquivo.previewUrl"
          :src="arquivo.previewUrl"
          alt=""
          class="size-10 shrink-0 rounded-md object-cover"
        >
        <span
          v-else
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[22px]">{{ iconeDoTipo(arquivo.tipo) }}</span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-on-surface dark:text-dark-on-surface">
            {{ arquivo.nome }}
          </span>
          <span class="block text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ rotuloDoTipo(arquivo.tipo) }} · {{ arquivo.tamanho }}
          </span>
        </span>
        <button
          type="button"
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
          :aria-label="`Remover ${arquivo.nome}`"
          :disabled="disabled"
          @click="remover(arquivo.id)"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </li>
    </ul>
  </div>
</template>
