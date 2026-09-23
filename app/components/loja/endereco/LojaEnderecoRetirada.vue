<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { parseCoordenadasValidas, urlGoogleMaps, urlWaze } from '#shared/utils/navegacaoMapas'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { canal } = storeToRefs(loja)

const enderecoTexto = computed(() => canal.value?.endereco?.trim() || '')
const coords = computed(() =>
  parseCoordenadasValidas(canal.value?.latitude, canal.value?.longitude),
)
const linkMaps = computed(() => (coords.value ? urlGoogleMaps(coords.value) : null))
const linkWaze = computed(() => (coords.value ? urlWaze(coords.value) : null))
</script>

<template>
  <section class="px-4 pt-6">
    <article class="rounded-2xl border border-[#00C853] px-4 py-4">
      <div class="mb-2 flex items-center gap-2 text-[#00C853]">
        <span class="flex h-5 w-5 items-center justify-center rounded-full border border-[#00C853]">
          <span class="h-2.5 w-2.5 rounded-full bg-[#00C853]" />
        </span>
        <p class="text-sm font-semibold">Retirar pedido no restaurante</p>
      </div>
      <p class="text-sm text-[#00C853]">Endereço:</p>
      <p class="whitespace-pre-line text-sm leading-snug text-[#00C853]">
        {{ enderecoTexto || 'Endereço não informado.' }}
      </p>
    </article>

    <div v-if="linkMaps && linkWaze" class="mt-3 flex flex-col gap-2">
      <a
        :href="linkMaps"
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-12 items-center justify-center gap-2 rounded-full border border-[#00C853] text-sm font-semibold text-[#00C853]"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" stroke-linejoin="round" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
        Ver no Maps
      </a>
      <a
        :href="linkWaze"
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-12 items-center justify-center gap-2 rounded-full border border-[#00C853] text-sm font-semibold text-[#00C853]"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" stroke-linejoin="round" />
          <path d="M12 10v4" stroke-linecap="round" />
        </svg>
        Ver no Waze
      </a>
    </div>
  </section>
</template>
