<script setup lang="ts">

import { computed, ref } from 'vue'

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

let abortFotos: AbortController | null = null



const tituloProduto = computed(() => selecionadoAtivo.value?.nome?.trim() || 'Produto')



function fecharSemSalvar() {

  if (salvandoImagens.value) return

  produtosStore.fecharModalImagens(false)

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



function adicionarUrl() {

  const u = novaUrl.value.trim()

  if (!u) return

  produtosStore.adicionarImagemEdicaoPorUrl(u)

  novaUrl.value = ''

}



function onEscolherArquivo(ev: Event) {

  const input = ev.target as HTMLInputElement

  const file = input.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) return

  produtosStore.adicionarImagemEdicaoPorArquivo(file)

  input.value = ''

}



function abrirSeletorArquivo() {

  inputArquivoRef.value?.click()

}



function urlExibicao(img: { url?: string | null; imagem_url?: string | null }): string {

  return String(img.imagem_url ?? img.url ?? '').trim()

}

</script>



<template>

  <BaseModal

    :open="modalImagensAberto"

    title="Imagens do produto"

    panel-class="w-full max-w-2xl"

    :close-on-backdrop="!salvandoImagens"

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

        Nenhuma imagem ainda. Adicione por URL ou ficheiro abaixo.

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

            v-if="urlExibicao(img)"

            :src="urlExibicao(img)"

            alt=""

            class="h-16 w-16 shrink-0 rounded-lg border border-outline/30 object-cover dark:border-dark-outline/35"

          />

          <div

            v-else

            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"

          >

            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">image</span>

          </div>

          <div class="min-w-0 flex-1">

            <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant" :title="urlExibicao(img)">

              {{ urlExibicao(img) || 'Sem URL' }}

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

          <BaseButton type="button" variant="secondary" :block="false" :disabled="salvandoImagens" @click="adicionarUrl">

            Adicionar URL

          </BaseButton>

        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-outline/20 pt-4 dark:border-dark-outline/25">

          <input

            ref="inputArquivoRef"

            type="file"

            accept="image/*"

            class="sr-only"

            :disabled="salvandoImagens"

            @change="onEscolherArquivo"

          />

          <BaseButton type="button" variant="primary" :block="false" :disabled="salvandoImagens" @click="abrirSeletorArquivo">

            <span class="inline-flex items-center gap-2">

              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">upload</span>

              Escolher ficheiro

            </span>

          </BaseButton>

        </div>

      </div>

    </div>



    <template #footer>

      <BaseButton type="button" variant="secondary" :block="false" :disabled="salvandoImagens" @click="fecharSemSalvar">

        Cancelar

      </BaseButton>

      <BaseButton type="button" variant="primary" :block="false" :disabled="salvandoImagens" @click="concluir">

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

