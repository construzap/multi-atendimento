<script setup lang="ts">
import { computed, ref } from 'vue'

type AdminPagina = 'prompt' | 'produtos' | 'ia'

const emit = defineEmits<{
  select: [pagina: AdminPagina]
}>()

const selected = ref<AdminPagina | null>(null)

const opcoes = [
  {
    id: 'prompt' as const,
    titulo: 'Prompt',
    descricao: 'Configure o comportamento, tom e instruções da IA para os atendimentos.',
    detalhe: 'System prompt, regras e contexto do assistente',
    gradient: 'bg-gradient-to-br from-info to-tertiary shadow-[0_10px_30px_rgba(0,99,154,0.25)]',
    icon: 'prompt',
  },
  {
    id: 'produtos' as const,
    titulo: 'Produtos',
    descricao: 'Gerencie catálogo, importações e configurações de produtos do workspace.',
    detalhe: 'Catálogo, categorias, termos de pesquisa e mídias',
    gradient: 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-[0_10px_30px_rgba(26,123,45,0.25)]',
    icon: 'produtos',
  },
  {
    id: 'ia' as const,
    titulo: 'I.A',
    descricao: 'Configure modelos, parâmetros e integrações de inteligência artificial.',
    detalhe: 'Modelos, temperatura, tokens e provedores',
    gradient: 'bg-gradient-to-br from-violet-500 to-purple-700 shadow-[0_10px_30px_rgba(124,58,237,0.25)]',
    icon: 'ia',
  },
] as const

const opcaoSelecionada = computed(() =>
  opcoes.find((o) => o.id === selected.value) ?? null,
)

async function selecionar(pagina: AdminPagina) {
  selected.value = pagina
  emit('select', pagina)

  if (pagina === 'prompt') {
    await navigateTo('/admin/prompt')
  } else if (pagina === 'ia') {
    await navigateTo('/admin/ia')
  }
}
</script>

<template>
  <section class="space-y-8">
    <header>
      <h2 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
        O que deseja editar?
      </h2>
      <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha a área do painel administrativo que você quer configurar
      </p>
    </header>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="opcao in opcoes"
        :key="opcao.id"
        type="button"
        class="group relative flex min-h-64 flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-dark-background"
        :class="
          selected === opcao.id
            ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-500 ring-offset-2 ring-offset-background dark:border-primary-600 dark:bg-primary-950/20 dark:ring-offset-dark-background'
            : 'border-outline/40 bg-surface-container-lowest hover:border-primary-300 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:hover:border-primary-700'
        "
        @click="selecionar(opcao.id)"
      >
        <div class="flex flex-1 flex-col p-6">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:scale-105"
              :class="opcao.gradient"
              aria-hidden="true"
            >
              <svg
                v-if="opcao.icon === 'prompt'"
                class="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M9.5 7.5H14.5M9.5 11H13M7 3h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2-3.5 2V5a2 2 0 0 1 2-2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else-if="opcao.icon === 'produtos'"
                class="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M6 7h12l-1.5 11H7.5L6 7z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg
                v-else
                class="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M12 3a6 6 0 0 0-3 10.5V17a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3.5A6 6 0 0 0 12 3z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M9 21h6M10 17h4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <span
              v-if="selected === opcao.id"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm"
              aria-hidden="true"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span
              v-else
              class="rounded-lg border border-outline/30 px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:border-dark-outline/30 dark:text-dark-on-surface-variant"
            >
              Selecionar
            </span>
          </div>

          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            {{ opcao.titulo }}
          </h3>
          <p class="mt-2 line-clamp-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ opcao.descricao }}
          </p>

          <div class="mt-auto pt-5">
            <div class="flex items-center gap-2 border-t border-outline/20 pt-4 dark:border-dark-outline/20">
              <svg
                class="h-4 w-4 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" stroke-linecap="round" />
              </svg>
              <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ opcao.detalhe }}
              </p>
            </div>
          </div>
        </div>
      </button>
    </div>

    <div
      v-if="opcaoSelecionada && opcaoSelecionada.id === 'produtos'"
      class="rounded-2xl border border-dashed border-primary-300 bg-primary-50/50 p-6 dark:border-primary-800/50 dark:bg-primary-950/20"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
        Próximo passo (em breve)
      </p>
      <p class="mt-2 font-body text-sm text-on-surface dark:text-dark-on-surface">
        Você selecionou
        <span class="font-semibold">{{ opcaoSelecionada.titulo }}</span>.
        Aqui entrará o fluxo de edição dessa área.
      </p>
    </div>
  </section>
</template>
