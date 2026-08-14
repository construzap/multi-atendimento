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
  <header class="border-b border-outline/30 bg-surface-container-lowest">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
      <h1 class="text-lg font-semibold text-on-surface">
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
              ? 'text-primary-600'
              : 'text-on-surface-variant hover:text-on-surface'
          "
        >
          {{ link.label }}
        </NuxtLink>
        <button
          type="button"
          class="text-sm text-on-surface-variant hover:text-on-surface"
          @click="useSupabaseClient().auth.signOut()"
        >
          Sair
        </button>
      </nav>
    </div>
  </header>
</template>
