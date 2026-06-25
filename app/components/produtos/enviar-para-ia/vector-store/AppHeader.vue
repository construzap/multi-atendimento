<script setup lang="ts">
defineProps<{
  title?: string
}>()

const route = useRoute()

const links = [
  { to: '/', label: 'Sincronizar' },
  { to: '/buscar', label: 'Buscar' },
]
</script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">
        {{ title ?? 'Vector Store — Produtos' }}
      </h1>

      <nav class="flex items-center gap-4">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="text-sm font-medium transition-colors"
          :class="
            route.path === link.to
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          "
        >
          {{ link.label }}
        </NuxtLink>
        <button
          type="button"
          class="text-sm text-gray-600 hover:text-gray-900"
          @click="useSupabaseClient().auth.signOut()"
        >
          Sair
        </button>
      </nav>
    </div>
  </header>
</template>
