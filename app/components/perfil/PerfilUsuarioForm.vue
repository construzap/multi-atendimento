<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'

const profile = useProfileStore()

const nome = computed({
  get: () => profile.me?.full_name ?? '',
  set: (value: string) => {
    if (!profile.me) return
    profile.me.full_name = value
  }
})

const email = computed(() => profile.me?.email ?? '')

const telefone = computed({
  get: () => profile.me?.whatsapp ?? '',
  set: (value: string) => {
    if (!profile.me) return
    profile.me.whatsapp = value
  }
})

function onSalvar() {
  /* UI — integrar depois */
}
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Perfil do Usuário
          </h3>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Atualize suas informações pessoais
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-dark-surface-container-high"
        >
          <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Editar
        </button>
      </div>
    </div>

    <div class="p-6">
      <div class="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-start">
        <div class="relative shrink-0">
          <div
            class="flex h-24 w-24 items-center justify-center rounded-2xl border border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
            aria-hidden="true"
          >
            <svg class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="12" cy="10" r="3" />
              <path d="M6.5 18.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke-linecap="round" />
            </svg>
          </div>
          <button
            type="button"
            class="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg transition-all hover:from-primary-600 hover:to-primary-700"
            aria-label="Alterar foto"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="mb-4 font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
            {{ nome }}
          </h4>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-lg bg-success-container px-3 py-1 text-xs font-semibold text-success-on-container">
              Ativo
            </span>
            <span class="rounded-lg bg-info-container px-3 py-1 text-xs font-semibold text-info-on-container">
              Verificado
            </span>
          </div>
        </div>
      </div>

      <form class="space-y-5" @submit.prevent="onSalvar">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="perfil-nome">
            Nome Completo
          </label>
          <BaseInput id="perfil-nome" v-model="nome" type="text" name="name" autocomplete="name">
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="perfil-email">
            Email
          </label>
          <BaseInput id="perfil-email" v-model="email" type="email" name="email" autocomplete="email" readonly>
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="perfil-tel">
            Telefone
          </label>
          <BaseInput id="perfil-tel" v-model="telefone" type="tel" name="phone" autocomplete="tel">
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div class="pt-2">
          <BaseButton id="btn-perfil-salvar" type="submit">
            Salvar Alterações
          </BaseButton>
        </div>
      </form>
    </div>
  </section>
</template>
