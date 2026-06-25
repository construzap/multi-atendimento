<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import { toast } from 'vue-sonner'

import BaseButton from '~/components/BaseButton.vue'

import BaseModal from '~/components/BaseModal.vue'

import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'

import ProdutosTabela from '~/components/produtos/ProdutosTabela.vue'

import type { ProdutoWorkspaceItem } from '#shared/types/produtos'

import { mensagemErroFetch } from '~/stores/canais'

import { useProdutosStore } from '~/stores/produtos'

import { useWorkspacesStore } from '~/stores/workspaces'



const open = defineModel<boolean>('open', { default: false })



const emit = defineEmits<{

  gravado: []

}>()



const produtosStore = useProdutosStore()

const workspacesStore = useWorkspacesStore()

const { criarEmMassaItems } = storeToRefs(produtosStore)



const salvando = ref(false)

const progressoAberto = ref(false)

const progressoTotal = ref(0)

const progressoEnviados = ref(0)

const progressoErro = ref<string | null>(null)

let abortController: AbortController | null = null



const workspaceIdTabela = computed(() => {

  const raw = workspacesStore.currentWorkspaceId

  if (raw == null || raw === '') return undefined

  const n = Number.parseInt(String(raw), 10)

  return Number.isFinite(n) && n >= 1 ? n : undefined

})



function garantirWorkspaceRascunho() {

  const raw = workspacesStore.currentWorkspaceId

  if (raw == null || raw === '') return

  const n = Number.parseInt(String(raw), 10)

  if (!Number.isFinite(n) || n < 1) return

  if (produtosStore.criarEmMassaWorkspaceId != null && produtosStore.criarEmMassaWorkspaceId !== n) {

    produtosStore.limparCriarEmMassa()

  }

  produtosStore.criarEmMassaWorkspaceId = n

}



function adicionarProduto() {
  if (salvando.value) return
  produtosStore.adicionarLinhaCriarEmMassa()
}



function aplicarAtualizado(row: ProdutoWorkspaceItem) {

  produtosStore.atualizarLinhaCriarEmMassa(row)

}



const podeSalvar = computed(() => !salvando.value && criarEmMassaItems.value.length > 0)



function fecharSemSalvar() {

  if (salvando.value) return

  produtosStore.limparCriarEmMassa()

  open.value = false

}



function cancelar() {

  if (salvando.value && abortController) {

    abortController.abort()

    return

  }

  fecharSemSalvar()

}



async function salvar() {

  if (!criarEmMassaItems.value.length) return



  progressoTotal.value = criarEmMassaItems.value.length

  progressoEnviados.value = 0

  progressoErro.value = null

  progressoAberto.value = true



  salvando.value = true

  abortController = new AbortController()



  try {

    const { inseridos, cancelado } = await produtosStore.enviarCriarEmMassaEmLotes({

      signal: abortController.signal,

      onProgress: (enviados, total) => {

        progressoEnviados.value = enviados

        progressoTotal.value = total

      },

    })



    if (cancelado) {

      toast.info('Envio cancelado.')

      return

    }



    produtosStore.limparCriarEmMassa()

    produtosStore.ultimoSnapshotKey = null

    toast.success(inseridos === 1 ? 'Produto criado.' : `${inseridos} produtos criados.`)

    open.value = false

    emit('gravado')

  } catch (err: unknown) {

    const e = err as { name?: string }

    if (e?.name === 'AbortError') {

      toast.info('Envio cancelado.')

    } else {

      const msg = mensagemErroFetch(err, 'Não foi possível salvar os produtos.')

      progressoErro.value = msg

      toast.error(msg)

    }

  } finally {

    salvando.value = false

    abortController = null

    if (!progressoErro.value) progressoAberto.value = false

  }

}



watch(open, (isOpen) => {

  if (isOpen) {

    garantirWorkspaceRascunho()

    return

  }

  if (salvando.value) {

    abortController?.abort()

    abortController = null

    salvando.value = false

  }

  progressoAberto.value = false

  progressoTotal.value = 0

  progressoEnviados.value = 0

  progressoErro.value = null

})

</script>



<template>

  <BaseModal v-model:open="open" title="Criar produtos em massa" panel-class="w-full max-w-[min(92rem,95vw)]">

    <template #subtitle>

      Adicione quantas linhas quiser e preencha os dados. Ao salvar, os produtos são enviados em lotes.

    </template>



    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">

      <BaseButton type="button" variant="primary" :block="false" :disabled="salvando" @click="adicionarProduto">

        <span class="inline-flex items-center gap-2">

          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>

          Adicionar produto

        </span>

      </BaseButton>

      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">

        Linhas:

        <strong class="text-on-surface dark:text-dark-on-surface">{{ criarEmMassaItems.length }}</strong>

      </p>

    </div>



    <ProdutosTabela

      :items="criarEmMassaItems"

      :workspace-id="workspaceIdTabela"

      modo="rascunho"

      :forcar-tabela-vazia="true"

      :mostrar-limite-linhas="false"

      :mostrar-selecao="false"

      :mostrar-exclusao="false"

      :mostrar-imagens="false"

      :enter-adiciona-linha="!salvando"

      :mostrar-linha-criar-rapido="false"

      :pending="false"

      :error="null"

      @atualizado="aplicarAtualizado"

      @adicionar-linha="adicionarProduto"

    />



    <template #footer>

      <BaseButton type="button" variant="secondary" :block="false" :disabled="salvando" @click="cancelar">

        Cancelar

      </BaseButton>

      <BaseButton type="button" variant="primary" :block="false" :disabled="!podeSalvar" @click="salvar">

        {{ salvando ? 'Salvando…' : 'Salvar' }}

      </BaseButton>

    </template>

  </BaseModal>



  <ModalEnvioProdutos

    v-model:open="progressoAberto"

    title="Enviando produtos para o banco…"

    :total="progressoTotal"

    :enviados="progressoEnviados"

    :erro="progressoErro"

    :pode-cancelar="salvando"

    @cancelar="cancelar"

  />

</template>

