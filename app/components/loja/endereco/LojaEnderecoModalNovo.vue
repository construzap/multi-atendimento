<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LojaGeocodeReverso } from '#shared/types/loja'
import { camposGeocodeFaltando, geocodeCompleto, mensagemGeocodeIncompleto } from '#shared/utils/lojaGeocode'
import LojaEnderecoConfirmarMapa from '~/components/loja/endereco/LojaEnderecoConfirmarMapa.vue'
import LojaEnderecoDetalhes from '~/components/loja/endereco/LojaEnderecoDetalhes.vue'
import LojaEnderecoFormularioManual from '~/components/loja/endereco/LojaEnderecoFormularioManual.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

type Passo = 'busca' | 'mapa' | 'detalhes'

const passo = ref<Passo>('busca')
const geo = ref<LojaGeocodeReverso | null>(null)
const pending = ref(false)
const confirmando = ref(false)
const buscando = ref(false)
const erro = ref('')

function fechar() {
  emit('update:open', false)
  emit('close')
}

function resetar() {
  passo.value = 'busca'
  geo.value = null
  pending.value = false
  confirmando.value = false
  buscando.value = false
  erro.value = ''
}

function validarGeoOuErro(g: LojaGeocodeReverso | null): boolean {
  const faltando = camposGeocodeFaltando(g)
  if (!faltando.length) {
    erro.value = ''
    return true
  }
  erro.value = mensagemGeocodeIncompleto(faltando)
  return false
}

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) resetar()
  },
)

async function geocodificar(lat: number, lon: number): Promise<LojaGeocodeReverso> {
  const res = await $fetch<{ ok: true; data: LojaGeocodeReverso }>(
    '/api/public/loja/geocode/reverse',
    { query: { lat, lon } },
  )
  return res.data
}

function usarMinhaLocalizacao() {
  erro.value = ''
  if (!import.meta.client || !navigator.geolocation) {
    erro.value = 'Este dispositivo não informa localização.'
    return
  }

  pending.value = true
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        geo.value = await geocodificar(pos.coords.latitude, pos.coords.longitude)
        passo.value = 'mapa'
        validarGeoOuErro(geo.value)
      } catch {
        erro.value = 'Não foi possível descobrir o endereço desta localização.'
      } finally {
        pending.value = false
      }
    },
    (err) => {
      pending.value = false
      if (err.code === 1) erro.value = 'Permissão de localização recusada.'
      else if (err.code === 3) erro.value = 'Tempo esgotado ao obter a localização.'
      else erro.value = 'Não foi possível obter a localização do aparelho.'
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
  )
}

async function buscarEnderecoMapa(coords: { lat: number; lon: number }) {
  if (buscando.value || confirmando.value) return
  buscando.value = true
  erro.value = ''
  try {
    geo.value = await geocodificar(coords.lat, coords.lon)
    validarGeoOuErro(geo.value)
  } catch {
    erro.value = 'Não foi possível atualizar o endereço do ponto no mapa.'
  } finally {
    buscando.value = false
  }
}

async function confirmarMapa(payload: { lat: number; lon: number; enderecoPreenchido: boolean }) {
  if (confirmando.value || buscando.value) return
  confirmando.value = true
  erro.value = ''
  try {
    if (!payload.enderecoPreenchido || !geocodeCompleto(geo.value)) {
      geo.value = await geocodificar(payload.lat, payload.lon)
    }
    if (!validarGeoOuErro(geo.value)) return
    passo.value = 'detalhes'
  } catch {
    erro.value = 'Não foi possível atualizar o endereço do ponto no mapa.'
  } finally {
    confirmando.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar endereço"
      @click.self="fechar"
    >
      <section
        class="flex h-[min(92vh,44rem)] w-full max-w-lg flex-col rounded-t-3xl bg-surface-container-lowest pt-2 dark:bg-dark-surface md:max-w-2xl"
      >
        <div class="mx-auto mb-1 h-1 w-10 rounded-full bg-outline/30 dark:bg-dark-outline/30" />

        <template v-if="passo === 'busca'">
          <header class="flex items-center justify-between px-5 py-3">
            <h2 class="text-lg font-semibold text-on-surface dark:text-dark-on-surface">
              Adicionar endereço
            </h2>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center text-on-surface dark:text-dark-on-surface"
              aria-label="Fechar"
              @click="fechar"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-5 pb-8">
            <button
              type="button"
              class="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#00C853] text-sm font-semibold text-[#00C853] disabled:opacity-60"
              :disabled="pending"
              @click="usarMinhaLocalizacao"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" stroke-linejoin="round" />
                <circle cx="12" cy="10" r="2.2" />
              </svg>
              {{ pending ? 'Obtendo localização…' : 'Usar minha localização' }}
            </button>

            <p v-if="erro" class="mt-3 text-center text-sm text-red-500">{{ erro }}</p>

            <p class="mt-5 mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
              Ou digite seu endereço:
            </p>

            <LojaEnderecoFormularioManual @salvo="fechar" @iniciar="erro = ''" />
          </div>
        </template>

        <LojaEnderecoConfirmarMapa
          v-else-if="passo === 'mapa' && geo"
          :geo="geo"
          :confirmando="confirmando"
          :buscando="buscando"
          :erro="erro"
          @confirmar="confirmarMapa"
          @buscar="buscarEnderecoMapa"
          @voltar="passo = 'busca'"
          @fechar="fechar"
        />

        <LojaEnderecoDetalhes
          v-else-if="passo === 'detalhes' && geo"
          :geo="geo"
          @voltar="passo = 'mapa'"
          @fechar="fechar"
          @salvo="fechar"
        />
      </section>
    </div>
  </Teleport>
</template>
