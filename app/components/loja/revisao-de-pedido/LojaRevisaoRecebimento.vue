<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { parseCoordenadasValidas, urlGoogleMaps, urlWaze } from '#shared/utils/navegacaoMapas'
import { formatarEnderecoLinhas } from '~/components/loja/endereco/enderecosMock'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { modoRecebimento, enderecos, enderecoSelecionadoId, canal } = storeToRefs(loja)

const eEntrega = computed(() => modoRecebimento.value === 'entrega')
const enderecoEntrega = computed(() =>
  enderecos.value.find((e) => e.id === enderecoSelecionadoId.value) ?? null,
)
const linhasEntrega = computed(() =>
  enderecoEntrega.value ? formatarEnderecoLinhas(enderecoEntrega.value) : [],
)

const enderecoLoja = computed(() => canal.value?.endereco?.trim() || '')
const coords = computed(() =>
  parseCoordenadasValidas(canal.value?.latitude, canal.value?.longitude),
)
const linkMaps = computed(() => (coords.value ? urlGoogleMaps(coords.value) : null))
const linkWaze = computed(() => (coords.value ? urlWaze(coords.value) : null))
</script>

<template>
  <section class="px-4 pt-5">
    <h2 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
      {{ eEntrega ? 'Entrega' : 'Retirada' }}
    </h2>

    <article
      v-if="eEntrega"
      class="mt-2 rounded-2xl border border-outline/30 px-4 py-4 dark:border-dark-outline/30"
    >
      <p
        v-for="(linha, i) in linhasEntrega"
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
      <p
        v-if="!linhasEntrega.length"
        class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum endereço selecionado.
      </p>
    </article>

    <template v-else>
      <article class="mt-2 rounded-2xl border border-[#00C853] px-4 py-4">
        <p class="text-sm font-semibold text-[#00C853]">Retirar no restaurante</p>
        <p class="mt-1 whitespace-pre-line text-sm leading-snug text-[#00C853]">
          {{ enderecoLoja || 'Endereço não informado.' }}
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
    </template>
  </section>
</template>
