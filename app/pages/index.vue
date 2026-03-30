<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({
  layout: 'default'
})
import { NuxtLink } from '#components'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import DemoTailwindActions from '~/components/DemoTailwindActions.vue'
import DemoTailwindHero from '~/components/DemoTailwindHero.vue'
import DemoTailwindPalette from '~/components/DemoTailwindPalette.vue'

const baseInputValue = ref('')

const userName = ref<string | null>(null)
const userEmail = ref<string | null>(null)
const authError = ref<string | null>(null)

onMounted(async () => {
  try {
    authError.value = null
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error

    userEmail.value = data.user?.email ?? null
    userName.value =
      (data.user?.user_metadata?.full_name as string | undefined) ??
      (data.user?.user_metadata?.name as string | undefined) ??
      null
  } catch (err) {
    authError.value = err instanceof Error ? err.message : 'Falha ao carregar usuário.'
  }
})

async function handleLogout() {
  authError.value = null
  try {
    const { logout } = useAuth()
    await logout()
    await navigateTo('/login')
  } catch (err) {
    authError.value = err instanceof Error ? err.message : 'Falha ao sair.'
  }
}
</script>

<template>
  <main
    class="mx-auto max-w-3xl space-y-8 px-4 py-8 transition-colors duration-500 ease-out-expo md:py-12"
  >
    <header
      class="animate-slide-in-right flex items-start justify-between gap-4 [animation-delay:80ms]"
    >
      <div>
        <p
          class="font-label text-xs uppercase tracking-wide text-on-surface-variant transition-colors dark:text-dark-on-surface-variant"
        >
          Início
        </p>
        <h1 class="font-headline text-xl font-bold text-on-surface transition-colors dark:text-dark-on-surface">
          Index
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink
          id="link-demo-componentes"
          to="/componentes"
          class="rounded-lg border border-outline bg-surface-container px-4 py-2 font-label text-sm text-primary shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:bg-surface-container-high hover:shadow-md active:scale-95 dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-primary dark:hover:bg-dark-surface-container-high"
        >
          Componentes
        </NuxtLink>
        <NuxtLink
          id="link-demo-login"
          to="/login"
          class="rounded-lg border border-outline bg-surface-container px-4 py-2 font-label text-sm text-primary shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:bg-surface-container-high hover:shadow-md active:scale-95 dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-primary dark:hover:bg-dark-surface-container-high"
        >
          Login
        </NuxtLink>
        <NuxtLink
          id="link-demo-page"
          to="/page"
          class="rounded-lg border border-outline bg-surface-container px-4 py-2 font-label text-sm text-primary shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:bg-surface-container-high hover:shadow-md active:scale-95 dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-primary dark:hover:bg-dark-surface-container-high"
        >
          Ir para /page
        </NuxtLink>
      </div>
    </header>

    <section
      class="animate-fade-in space-y-3 rounded-xl border border-outline/40 bg-surface-container-low p-5 shadow-sm [animation-delay:90ms] dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="font-headline text-lg font-semibold text-on-surface dark:text-dark-on-surface">
            Usuário
          </h2>
          <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            <span class="font-semibold">Nome:</span> {{ userName || 'sem nome' }}
          </p>
          <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            <span class="font-semibold">Email:</span> {{ userEmail || '—' }}
          </p>
        </div>

        <BaseButton id="btn-logout" type="button" @click="handleLogout">Sair</BaseButton>
      </div>

      <p v-if="authError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ authError }}
      </p>
    </section>

    <section
      class="animate-fade-in space-y-4 rounded-xl border border-outline/40 bg-surface-container-low p-5 shadow-sm [animation-delay:100ms] dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <h2 class="font-headline text-lg font-semibold text-on-surface dark:text-dark-on-surface">
        Componentes base
      </h2>
      <BaseInput
        v-model="baseInputValue"
        wrapper-id="base-input-demo"
        placeholder="Campo base (com ícone)"
      >
        <template #leading>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" stroke-linecap="round" />
          </svg>
        </template>
      </BaseInput>
      <BaseButton id="base-button-demo">Botão base</BaseButton>
    </section>

    <DemoTailwindHero class="animate-slide-up [animation-delay:140ms]" />
    <DemoTailwindPalette class="animate-slide-up [animation-delay:240ms]" />
    <DemoTailwindActions class="animate-fade-in [animation-delay:320ms]" />

    <footer
      class="animate-fade-in rounded-lg border border-dashed border-outline-variant bg-surface-container p-4 font-body text-sm text-on-surface-variant shadow-sm transition-colors duration-300 [animation-delay:400ms] dark:border-dark-outline-variant dark:bg-dark-surface-container dark:text-dark-on-surface-variant"
    >
      Tipografia:
      <span class="font-headline text-on-surface transition-colors dark:text-dark-on-surface">headline</span>
      ·
      <span class="font-body">body</span> · <span class="font-label">label</span>
    </footer>
  </main>
</template>
