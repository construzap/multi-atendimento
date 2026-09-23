<script setup lang="ts">
import { computed } from 'vue'
import type { LojaProdutoPublico } from '#shared/types/loja'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  produto: LojaProdutoPublico
}>()

const precoExibir = computed(() => {
  const promo = props.produto.preco_promocional
  if (promo != null && Number.isFinite(promo)) return promo
  return props.produto.preco
})

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function selecionar() {
  const loja = useLojaWorkspaceStore()
  loja.abrirProdutoUnico(props.produto)
  const slug = loja.slug?.trim()
  if (!slug) return
  void navigateTo(`/loja/${encodeURIComponent(slug)}/${props.produto.id}`)
}
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="flex cursor-pointer gap-3 border-b border-outline/25 py-4 last:border-b-0 dark:border-dark-outline/25"
    @click="selecionar"
    @keydown.enter.prevent="selecionar"
  >
    <div class="min-w-0 flex-1">
      <h3 class="text-[15px] font-semibold leading-snug text-on-surface dark:text-dark-on-surface">
        {{ produto.nome }}
      </h3>
      <p
        v-if="produto.descricao"
        class="mt-1 line-clamp-2 text-sm leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ produto.descricao }}
      </p>
      <p
        v-if="precoExibir != null"
        class="mt-3 text-[15px] font-bold text-on-surface dark:text-dark-on-surface"
      >
        {{ formatPreco(precoExibir) }}
      </p>
    </div>

    <div
      class="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-surface-container dark:bg-dark-surface-container"
    >
      <img
        v-if="produto.imagem_url"
        :src="produto.imagem_url"
        :alt="produto.nome"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Sem foto
      </div>
    </div>
  </article>
</template>
