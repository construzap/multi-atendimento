<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
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

async function onSalvar() {
  try {
    const fullName = nome.value.trim()
    const whatsapp = telefone.value.trim()

    if (!fullName) {
      toast.warning('Informe o nome.')
      return
    }

    if (!whatsapp) {
      toast.warning('Informe o WhatsApp.')
      return
    }

    await profile.updateMe({
      full_name: fullName,
      whatsapp
    })
    toast.success('Dados atualizados com sucesso.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao salvar.')
  }
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
            WhatsApp
          </label>
          <BaseInput
            id="perfil-tel"
            v-model="telefone"
            type="tel"
            name="whatsapp"
            autocomplete="tel"
            inputmode="numeric"
            pattern="^[0-9]{12,13}$"
            :maxlength="13"
            placeholder="5571999293684"
            title="Formato: (55 + DDD + 9 + os 8 dígitos, sem espaços). Exemplo: 5571988570826"
            invalid-message="Formato inválido. Use: (55 + DDD + 9 + os 8 dígitos, sem espaços).\n\n👉Exemplo: 5571988570826"
          >
            <template #leading>
              <svg class="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div class="pt-2">
          <BaseButton id="btn-perfil-salvar" type="submit" :disabled="profile.pending">
            {{ profile.pending ? 'Salvando...' : 'Salvar Alterações' }}
          </BaseButton>
        </div>
      </form>
    </div>
  </section>
</template>
