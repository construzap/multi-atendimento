<script setup lang="ts">
import { computed } from 'vue'
import type { LojaEndereco } from '#shared/types/loja'
import { formatarEnderecoLinhas } from '~/components/loja/endereco/enderecosMock'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  endereco: LojaEndereco
  selecionado: boolean
}>()

const emit = defineEmits<{
  editar: [endereco: LojaEndereco]
  apagar: [endereco: LojaEndereco]
}>()

const loja = useLojaWorkspaceStore()
const linhas = computed(() => formatarEnderecoLinhas(props.endereco))
</script>

<template>
  <article
    class="flex gap-3 rounded-2xl border px-4 py-4"
    :class="
      selecionado
        ? 'border-[#00C853]'
        : 'border-outline/30 dark:border-dark-outline/30'
    "
  >
    <button
      type="button"
      class="min-w-0 flex-1 text-left"
      @click="loja.selecionarEndereco(endereco.id)"
    >
      <p
        v-for="(linha, i) in linhas"
        :key="i"
        class="text-sm leading-snug"
        :class="
          i === 0
            ? 'font-semibold text-on-surface dark:text-dark-on-surface'
            : 'text-on-surface-variant dark:text-dark-on-surface-variant'
        "
      >
        {{ linha }}
      </p>
    </button>

    <div class="flex shrink-0 flex-col items-center gap-3">
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center"
        aria-label="Selecionar endereço"
        @click="loja.selecionarEndereco(endereco.id)"
      >
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full border"
          :class="selecionado ? 'border-[#00C853]' : 'border-outline/50 dark:border-dark-outline/50'"
        >
          <span v-if="selecionado" class="h-2.5 w-2.5 rounded-full bg-[#00C853]" />
        </span>
      </button>
      <button
        type="button"
        class="text-on-surface-variant dark:text-dark-on-surface-variant"
        aria-label="Editar endereço"
        @click="emit('editar', endereco)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 20h4l10-10-4-4L4 16v4z" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="text-on-surface-variant dark:text-dark-on-surface-variant"
        aria-label="Apagar endereço"
        @click="emit('apagar', endereco)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </article>
</template>
