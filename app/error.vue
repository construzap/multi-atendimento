<script setup lang="ts">
import type { NuxtError } from '#app'
import { MSG_SEM_PERMISSAO_PAGINA } from '#shared/types/pageRoles'

const props = defineProps<{ error: NuxtError }>()

const isForbidden = computed(() => props.error?.statusCode === 403)

const titulo = computed(() =>
  isForbidden.value ? 'Acesso negado' : 'Algo deu errado',
)

const mensagem = computed(() => {
  const raw = String(props.error?.message || props.error?.statusMessage || '').trim()
  if (isForbidden.value) {
    // statusMessage curto ("Acesso negado") não substitui a orientação ao suporte
    if (!raw || raw === 'Acesso negado') return MSG_SEM_PERMISSAO_PAGINA
    return raw
  }
  return raw || 'Ocorreu um erro inesperado. Tente novamente.'
})

function voltarInicio() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-on-surface dark:bg-dark-background dark:text-dark-on-surface"
  >
    <div class="w-full max-w-md text-center">
      <p class="text-sm font-medium uppercase tracking-wide text-primary-500">
        {{ error.statusCode || 500 }}
      </p>
      <h1 class="mt-3 text-2xl font-semibold tracking-tight">
        {{ titulo }}
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {{ mensagem }}
      </p>
      <button
        type="button"
        class="mt-8 inline-flex items-center justify-center rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        @click="voltarInicio"
      >
        Voltar ao início
      </button>
    </div>
  </div>
</template>
