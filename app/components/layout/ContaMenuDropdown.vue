<script setup lang="ts">
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { useColorMode } from '~/composables/useColorMode'

defineProps<{
  avatarUrl: string | null
}>()

const { isDark, toggle: toggleTheme } = useColorMode()

async function handleLogout(close: () => void) {
  close()
  try {
    const { logout } = useAuth()
    await logout()
    await navigateTo('/login')
  } catch {
    /* feedback opcional */
  }
}
</script>

<template>
  <BaseDropdown title="Conta" align="right">
    <template #trigger>
      <span class="inline-flex items-center rounded-full ring-2 ring-transparent outline-none">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          class="h-9 w-9 rounded-full object-cover"
        />
        <span
          v-else
          class="flex h-9 w-9 items-center justify-center rounded-full border border-outline/50 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/50 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M6 19.5a6 6 0 0 1 12 0" stroke-linecap="round" />
          </svg>
        </span>
      </span>
    </template>

    <template #default="{ close }">
      <NuxtLink
        to="/perfil"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
        @click="close"
      >
        <svg class="h-4 w-4 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Perfil
      </NuxtLink>

      <NuxtLink
        to="/assinatura"
        role="menuitem"
        class="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
        @click="close"
      >
        <svg class="h-4 w-4 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h4M7 12h10" stroke-linecap="round" />
        </svg>
        Assinatura
      </NuxtLink>

      <button
        type="button"
        role="menuitem"
        class="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
        @click="toggleTheme(); close()"
      >
        <svg
          v-if="!isDark"
          class="h-4 w-4 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          v-else
          class="h-4 w-4 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke-linecap="round" />
        </svg>
        {{ isDark ? 'Modo claro' : 'Modo escuro' }}
      </button>

      <button
        type="button"
        role="menuitem"
        class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-container/40 dark:text-danger dark:hover:bg-danger-container/30"
        @click="handleLogout(close)"
      >
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Sair
      </button>
    </template>
  </BaseDropdown>
</template>
