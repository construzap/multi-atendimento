<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ContaMenuDropdown from '~/components/layout/ContaMenuDropdown.vue'

const avatarUrl = ref<string | null>(null)

onMounted(async () => {
  const supabase = useSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const u = data.user
  avatarUrl.value =
    (u?.user_metadata?.avatar_url as string | undefined) ??
    (u?.user_metadata?.picture as string | undefined) ??
    null
})
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-outline/40 bg-surface-container-lowest/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80 dark:border-dark-outline/40 dark:bg-dark-surface-container-low/95 dark:supports-[backdrop-filter]:bg-dark-surface-container-low/80"
  >
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
      <NuxtLink
        to="/"
        class="flex items-center gap-2.5 rounded-lg font-headline text-lg font-bold tracking-tight text-on-surface transition-colors hover:text-primary-600 dark:text-dark-on-surface dark:hover:text-dark-primary"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a8 8 0 0 1-8 8H6l-3 3v-3a8 8 0 0 1 8-8h10z" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 8a4 4 0 0 1 8 0" stroke-linecap="round" />
          </svg>
        </span>
        <span>construzap</span>
      </NuxtLink>

      <ContaMenuDropdown :avatar-url="avatarUrl" />
    </div>
  </header>
</template>
