<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'
import LojaLoginBotao from '~/components/loja/login/LojaLoginBotao.vue'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'

const loja = useLojaWorkspaceStore()
const { nome, logo_url, aguardando, slug } = storeToRefs(loja)
const loginAberto = ref(false)
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-outline/40 bg-surface-container-lowest/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80 dark:border-dark-outline/40 dark:bg-dark-surface-container-low/95 dark:supports-[backdrop-filter]:bg-dark-surface-container-low/80"
  >
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
      <div
        v-if="logo_url"
        class="flex h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-surface-container dark:bg-dark-surface-container"
      >
        <img :src="logo_url" :alt="nome || 'Logo'" class="h-full w-full object-cover" />
      </div>
      <div
        v-else-if="slug && aguardando"
        class="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-surface-container dark:bg-dark-surface-container"
        aria-hidden="true"
      />

      <h1 class="min-w-0 flex-1 truncate font-headline text-lg font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        <template v-if="slug && aguardando && !nome">Carregando…</template>
        <template v-else>{{ nome || 'Loja' }}</template>
      </h1>

      <LojaLoginBotao @click="loginAberto = true" />
    </div>
  </header>

  <LojaLoginModal v-model:open="loginAberto" />
</template>
