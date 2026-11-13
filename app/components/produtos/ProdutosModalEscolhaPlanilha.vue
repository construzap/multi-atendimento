<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoEscolhaPendente,
  ProdutosEscolhaPlanilhaListaResponse,
  ProdutosEscolhaPlanilhaResponse,
} from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch } from '~/stores/canais'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  escolhido: []
}>()

const carregando = ref(false)
const escolhendoId = ref<number | null>(null)
const erro = ref<string | null>(null)
const pendentes = ref<ProdutoEscolhaPendente[]>([])

function fmtPreco(n: number | null): string {
  if (n == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

async function carregar() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    pendentes.value = []
    return
  }
  carregando.value = true
  erro.value = null
  try {
    const resp = await $fetch<ProdutosEscolhaPlanilhaListaResponse>('/api/produtos/planilha/escolha-planilha', {
      query: { workspace_id: wid },
    })
    pendentes.value = resp.data ?? []
  } catch (err) {
    erro.value = mensagemErroFetch(err, 'Não foi possível carregar as pendências.')
    pendentes.value = []
  } finally {
    carregando.value = false
  }
}

async function escolher(produtoId: number, candidatoId: number) {
  const wid = props.workspaceId
  if (wid == null || wid < 1 || escolhendoId.value != null) return
  escolhendoId.value = candidatoId
  try {
    const resp = await $fetch<ProdutosEscolhaPlanilhaResponse>('/api/produtos/planilha/escolha-planilha', {
      method: 'POST',
      body: { workspace_id: wid, produto_id: produtoId, candidato_id: candidatoId },
    })
    if (resp.ainda_pendente) {
      toast.message('Esse código de barras está em mais de um produto. Escolha em qual deles entra.')
    } else {
      toast.success('Produto atualizado.')
    }
    emit('escolhido')
    await carregar()
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível gravar a escolha.'))
  } finally {
    escolhendoId.value = null
  }
}

watch(open, (aberto) => {
  if (aberto) void carregar()
})
</script>

<template>
  <BaseModal v-model:open="open" title="Escolher em qual produto entra" panel-class="w-full max-w-3xl">
    <template #subtitle>
      <span class="block leading-relaxed">
        Estas linhas da planilha acharam mais de um produto. Escolha qual recebe o preço e os outros campos.
      </span>
    </template>

    <p v-if="carregando" class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      A carregar…
    </p>
    <p v-else-if="erro" class="text-sm text-red-700 dark:text-red-300">{{ erro }}</p>
    <p v-else-if="!pendentes.length" class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Nenhuma linha aguardando escolha.
    </p>

    <ul v-else class="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
      <li
        v-for="item in pendentes"
        :key="item.id"
        class="rounded-xl border border-outline/40 p-3 dark:border-dark-outline/40"
      >
        <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          {{ item.nome }}
        </p>
        <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          <span v-if="item.codigo">Código {{ item.codigo }}</span>
          <span v-if="item.codigo && item.codigo_barras_ean"> · </span>
          <span v-if="item.codigo_barras_ean">Barras {{ item.codigo_barras_ean }}</span>
          <span v-if="item.preco != null"> · {{ fmtPreco(item.preco) }}</span>
        </p>
        <ul class="mt-3 space-y-2">
          <li
            v-for="cand in item.candidatos"
            :key="cand.id"
            class="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2 dark:bg-dark-surface-container-low"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-on-surface dark:text-dark-on-surface">
                {{ cand.nome }}
              </p>
              <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                <span v-if="cand.codigo">Código {{ cand.codigo }}</span>
                <span v-if="cand.codigo_barras"> · Barras {{ cand.codigo_barras }}</span>
                <span v-if="cand.categoria"> · {{ cand.categoria }}</span>
                <span v-if="cand.preco != null"> · {{ fmtPreco(cand.preco) }}</span>
              </p>
            </div>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :block="false"
              :disabled="escolhendoId != null"
              @click="escolher(item.id, cand.id)"
            >
              {{ escolhendoId === cand.id ? 'A gravar…' : 'Usar este' }}
            </BaseButton>
          </li>
        </ul>
      </li>
    </ul>
  </BaseModal>
</template>
