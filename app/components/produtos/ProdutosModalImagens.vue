<script setup lang="ts">

import { computed, onUnmounted, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import { toast } from 'vue-sonner'

import BaseButton from '~/components/BaseButton.vue'

import BaseModal from '~/components/BaseModal.vue'

import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'

import { mensagemErroFetch } from '~/stores/canais'

import { useProdutosStore } from '~/stores/produtos'



const produtosStore = useProdutosStore()

const {

  modalImagensAberto,

  selecionadoAtivo,

  imagensEdicaoRascunho,

  progressoFotosAberto,

  progressoFotosTotal,

  progressoFotosEnviados,

  progressoFotosErro,

  salvandoImagens,

} = storeToRefs(produtosStore)



const novaUrl = ref('')
const inputArquivoRef = ref<HTMLInputElement | null>(null)
const enviandoImagem = ref(false)
const arrastandoArquivo = ref(false)
let abortFotos: AbortController | null = null
let arrastandoDepth = 0

const uploadDesabilitado = computed(() => salvandoImagens.value || enviandoImagem.value)



const tituloProduto = computed(() => selecionadoAtivo.value?.nome?.trim() || 'Produto')



async function fecharSemSalvar() {
  if (salvandoImagens.value || enviandoImagem.value) return
  await produtosStore.fecharModalImagens(false)
  novaUrl.value = ''
}



async function concluir() {

  if (salvandoImagens.value) return

  abortFotos = new AbortController()

  try {

    const res = await produtosStore.salvarImagensEdicao({ signal: abortFotos.signal })

    if (res.cancelado) {

      toast.info('Atualização de imagens cancelada.')

      return

    }

    toast.success('Imagens atualizadas.')
    novaUrl.value = ''

  } catch (err) {

    toast.error(mensagemErroFetch(err, 'Não foi possível salvar as imagens.'))

  } finally {

    abortFotos = null

  }

}



function cancelarProgresso() {

  abortFotos?.abort()

}



async function adicionarUrl() {
  const u = novaUrl.value.trim()
  if (!u || enviandoImagem.value || salvandoImagens.value) return
  enviandoImagem.value = true
  try {
    if (produtosStore.podeSalvarImagensNaApi()) {
      await produtosStore.enviarUrlImagemEdicaoApi(u)
    } else {
      produtosStore.adicionarImagemEdicaoPorUrl(u)
    }
    novaUrl.value = ''
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível adicionar a URL da imagem.'))
  } finally {
    enviandoImagem.value = false
  }
}

async function processarArquivosImagem(files: File[]) {
  if (salvandoImagens.value || enviandoImagem.value) return

  const imagens = files.filter((f) => f.type.startsWith('image/'))
  if (!imagens.length) {
    toast.error('Nenhuma imagem válida encontrada.')
    return
  }

  const usaApi = produtosStore.podeSalvarImagensNaApi()
  if (usaApi) enviandoImagem.value = true

  try {
    for (const file of imagens) {
      if (salvandoImagens.value) break
      if (usaApi) {
        await produtosStore.enviarArquivoImagemEdicaoApi(file)
      } else {
        produtosStore.adicionarImagemEdicaoPorArquivo(file)
      }
    }
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível enviar a imagem.'))
  } finally {
    if (usaApi) enviandoImagem.value = false
  }
}

function arquivosImagemDoClipboard(items: DataTransferItemList | null | undefined): File[] {
  if (!items) return []
  const files: File[] = []
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

function onPasteImagem(ev: ClipboardEvent) {
  if (!modalImagensAberto.value || uploadDesabilitado.value) return

  const files = arquivosImagemDoClipboard(ev.clipboardData?.items)
  if (!files.length) return

  ev.preventDefault()
  void processarArquivosImagem(files)
}

function onDragEnterZona(ev: DragEvent) {
  ev.preventDefault()
  if (uploadDesabilitado.value) return
  arrastandoDepth += 1
  arrastandoArquivo.value = true
}

function onDragOverZona(ev: DragEvent) {
  ev.preventDefault()
  if (uploadDesabilitado.value) return
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'
}

function onDragLeaveZona(ev: DragEvent) {
  ev.preventDefault()
  arrastandoDepth = Math.max(0, arrastandoDepth - 1)
  if (arrastandoDepth === 0) arrastandoArquivo.value = false
}

function onDropZona(ev: DragEvent) {
  ev.preventDefault()
  arrastandoDepth = 0
  arrastandoArquivo.value = false
  if (uploadDesabilitado.value) return

  const files = Array.from(ev.dataTransfer?.files ?? [])
  void processarArquivosImagem(files)
}

watch(modalImagensAberto, (aberto) => {
  if (aberto) {
    document.addEventListener('paste', onPasteImagem)
    return
  }
  document.removeEventListener('paste', onPasteImagem)
  arrastandoDepth = 0
  arrastandoArquivo.value = false
})

onUnmounted(() => {
  document.removeEventListener('paste', onPasteImagem)
})

async function onEscolherArquivo(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  await processarArquivosImagem(files)
}



function abrirSeletorArquivo() {

  inputArquivoRef.value?.click()

}



function urlPreview(img: { url?: string | null; imagem_url?: string | null }): string {
  return String(img.imagem_url ?? img.url ?? '').trim()
}

/** Texto auxiliar na lista (não expõe blob cru). */
function urlRotulo(img: { url?: string | null; imagem_url?: string | null }): string {
  const u = urlPreview(img)
  if (!u) return 'Sem URL'
  if (u.startsWith('blob:')) return 'Pré-visualização local'
  return u
}

</script>



<template>

  <BaseModal

    :open="modalImagensAberto"

    title="Imagens do produto"

    panel-class="w-full max-w-2xl"

    :close-on-backdrop="!salvandoImagens && !enviandoImagem"

    @update:open="(v) => { if (!v) fecharSemSalvar() }"

  >

    <template #subtitle>

      <span class="block text-lg font-semibold leading-snug text-on-surface dark:text-dark-on-surface">

        {{ tituloProduto }}

      </span>

    </template>



    <template #icon>

      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">photo_library</span>

    </template>



    <div class="space-y-5">

      <div

        v-if="!imagensEdicaoRascunho.length"

        class="rounded-xl border border-dashed border-outline/45 bg-surface-container-low/50 px-4 py-10 text-center text-sm text-on-surface-variant dark:border-dark-outline/45 dark:bg-dark-surface-container-low/40 dark:text-dark-on-surface-variant"

      >

        Nenhuma imagem ainda. Arraste, cole com Ctrl+V ou adicione por URL abaixo.

      </div>



      <ul v-else class="space-y-3">

        <li

          v-for="(img, index) in imagensEdicaoRascunho"

          :key="String(img.id ?? index)"

          class="flex items-center gap-3 rounded-xl border border-outline/35 bg-surface-container-lowest p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest"

        >

          <span

            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/12 text-xs font-bold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"

            aria-hidden="true"

          >

            {{ index + 1 }}

          </span>

          <img

            v-if="urlPreview(img)"

            :src="urlPreview(img)"

            alt=""

            referrerpolicy="no-referrer"

            class="h-16 w-16 shrink-0 rounded-lg border border-outline/30 object-cover dark:border-dark-outline/35"

          />

          <div

            v-else

            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"

          >

            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">image</span>

          </div>

          <div class="min-w-0 flex-1">

            <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant" :title="urlRotulo(img)">

              {{ urlRotulo(img) }}

            </p>

            <p v-if="index === 0" class="mt-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400">

              Capa (primeira da lista)

            </p>

          </div>

          <div class="flex shrink-0 flex-col gap-1 sm:flex-row">

            <button

              type="button"

              class="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-35 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"

              :disabled="index === 0 || salvandoImagens"

              aria-label="Mover para cima"

              @click="produtosStore.moverImagemEdicao(index, -1)"

            >

              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_upward</span>

            </button>

            <button

              type="button"

              class="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-35 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"

              :disabled="index >= imagensEdicaoRascunho.length - 1 || salvandoImagens"

              aria-label="Mover para baixo"

              @click="produtosStore.moverImagemEdicao(index, 1)"

            >

              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_downward</span>

            </button>

            <button

              type="button"

              class="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-35 dark:text-red-400 dark:hover:bg-red-950/40"

              :disabled="salvandoImagens"

              aria-label="Remover imagem"

              @click="produtosStore.removerImagemEdicao(index)"

            >

              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>

            </button>

          </div>

        </li>

      </ul>



      <div class="rounded-xl border border-outline/30 bg-surface-container-low/40 p-4 dark:border-dark-outline/35 dark:bg-dark-surface-container-low/35">

        <p class="mb-3 text-sm font-semibold text-on-surface dark:text-dark-on-surface">Adicionar imagem</p>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">

          <div class="min-w-0 flex-1">

            <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">

              URL da imagem

            </label>

            <input

              v-model="novaUrl"

              type="url"

              autocomplete="off"

              class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"

              placeholder="https://…"

              :disabled="salvandoImagens"

              @keydown.enter.prevent="adicionarUrl"

            />

          </div>

          <BaseButton type="button" variant="secondary" :block="false" :disabled="salvandoImagens || enviandoImagem" @click="adicionarUrl">
            {{ enviandoImagem ? 'Enviando…' : 'Adicionar URL' }}
          </BaseButton>

        </div>

        <div
          class="mt-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors"
          :class="
            arrastandoArquivo
              ? 'border-primary-500 bg-primary-500/8 dark:border-primary-400 dark:bg-primary-500/12'
              : 'border-outline/40 bg-surface-container-lowest/60 hover:border-outline/55 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest/50 dark:hover:border-dark-outline/55'
          "
          role="button"
          tabindex="0"
          :aria-disabled="uploadDesabilitado"
          @dragenter="onDragEnterZona"
          @dragover="onDragOverZona"
          @dragleave="onDragLeaveZona"
          @drop="onDropZona"
          @click="!uploadDesabilitado && abrirSeletorArquivo()"
          @keydown.enter.prevent="!uploadDesabilitado && abrirSeletorArquivo()"
          @keydown.space.prevent="!uploadDesabilitado && abrirSeletorArquivo()"
        >
          <input
            ref="inputArquivoRef"
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            :disabled="uploadDesabilitado"
            @change="onEscolherArquivo"
          />

          <span
            class="material-symbols-outlined mx-auto mb-2 block text-[36px] text-primary-600 dark:text-primary-400"
            aria-hidden="true"
          >
            {{ arrastandoArquivo ? 'download' : 'cloud_upload' }}
          </span>

          <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ enviandoImagem ? 'Enviando imagem…' : 'Arraste imagens para aqui' }}
          </p>
          <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            ou clique para escolher · Ctrl+V para colar do clipboard
          </p>
        </div>

      </div>

    </div>



    <template #footer>

      <BaseButton type="button" variant="secondary" :block="false" :disabled="salvandoImagens || enviandoImagem" @click="fecharSemSalvar">
        Cancelar
      </BaseButton>
      <BaseButton type="button" variant="primary" :block="false" :disabled="salvandoImagens || enviandoImagem" @click="concluir">
        {{ salvandoImagens ? 'Salvando…' : 'Concluir' }}
      </BaseButton>

    </template>

  </BaseModal>



  <ModalEnvioProdutos

    v-model:open="progressoFotosAberto"

    title="Atualizando imagens do produto…"

    :total="progressoFotosTotal"

    :enviados="progressoFotosEnviados"

    :erro="progressoFotosErro"

    :pode-cancelar="salvandoImagens"

    @cancelar="cancelarProgresso"

  />

</template>

