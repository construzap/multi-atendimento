<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LojaGeocodeReverso } from '#shared/types/loja'
import { geocodeCompleto } from '#shared/utils/lojaGeocode'
import { resumoEndereco } from '~/components/loja/endereco/enderecosMock'

const props = defineProps<{
  geo: LojaGeocodeReverso
  confirmando?: boolean
  buscando?: boolean
  erro?: string
}>()

const emit = defineEmits<{
  confirmar: [payload: { lat: number; lon: number; enderecoPreenchido: boolean }]
  buscar: [coords: { lat: number; lon: number }]
  voltar: []
  fechar: []
}>()

const mapaEl = ref<HTMLDivElement | null>(null)
const mapaMovido = ref(false)
const resumo = computed(() => resumoEndereco(props.geo))
const geoCompleto = computed(() => geocodeCompleto(props.geo))
const enderecoPreenchido = computed(() => !mapaMovido.value && geoCompleto.value)
const mostrarBuscar = computed(() => mapaMovido.value || !geoCompleto.value)
const podeConfirmar = computed(() => geoCompleto.value && !mapaMovido.value && !props.confirmando && !props.buscando)

type LeafletNs = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LeafletMap) => void }
}

type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap
  getCenter: () => { lat: number; lng: number }
  zoomIn: () => void
  zoomOut: () => void
  remove: () => void
  invalidateSize: () => void
  on: (event: string, fn: () => void) => void
  off: (event: string, fn: () => void) => void
}

let map: LeafletMap | null = null
const LIMIAR_MOVIMENTO = 0.00001

function centroDiferente(lat: number, lon: number) {
  return Math.abs(lat - props.geo.lat) > LIMIAR_MOVIMENTO
    || Math.abs(lon - props.geo.lon) > LIMIAR_MOVIMENTO
}

function aoMoverMapa() {
  if (!map) return
  const c = map.getCenter()
  mapaMovido.value = centroDiferente(c.lat, c.lng)
}

watch(
  () => props.geo,
  () => {
    mapaMovido.value = false
  },
)

function loadLeaflet(): Promise<LeafletNs> {
  const w = window as Window & { L?: LeafletNs }
  if (w.L) return Promise.resolve(w.L)

  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet', '1')
      document.head.appendChild(link)
    }
    const existente = document.querySelector<HTMLScriptElement>('script[data-leaflet]')
    if (existente) {
      existente.addEventListener('load', () => (w.L ? resolve(w.L) : reject(new Error('Leaflet não carregou.'))))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.setAttribute('data-leaflet', '1')
    script.onload = () => {
      if (w.L) resolve(w.L)
      else reject(new Error('Leaflet não carregou.'))
    }
    script.onerror = () => reject(new Error('Falha ao carregar o mapa.'))
    document.head.appendChild(script)
  })
}

function aproximar() {
  map?.zoomIn()
}

function afastar() {
  map?.zoomOut()
}

onMounted(async () => {
  if (!mapaEl.value) return
  const L = await loadLeaflet()
  map = L.map(mapaEl.value, {
    zoomControl: false,
    attributionControl: false,
  }).setView([props.geo.lat, props.geo.lon], 17)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map)
  map.on('moveend', aoMoverMapa)
  requestAnimationFrame(() => map?.invalidateSize())
})

onBeforeUnmount(() => {
  map?.off('moveend', aoMoverMapa)
  map?.remove()
  map = null
})

function centroAtual() {
  if (!map) return { lat: props.geo.lat, lon: props.geo.lon }
  const c = map.getCenter()
  return { lat: c.lat, lon: c.lng }
}

function buscarEndereco() {
  if (props.buscando || props.confirmando) return
  emit('buscar', centroAtual())
}

function confirmar() {
  if (!map || !podeConfirmar.value) return
  emit('confirmar', { ...centroAtual(), enderecoPreenchido: enderecoPreenchido.value })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-center justify-between px-5 py-3">
      <h2 class="text-lg font-semibold text-on-surface dark:text-dark-on-surface">
        Confirmar localização
      </h2>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center text-on-surface dark:text-dark-on-surface"
        aria-label="Fechar"
        @click="emit('fechar')"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="mx-5 rounded-2xl bg-primary-50 px-4 py-3 text-center dark:bg-dark-surface-container">
      <template v-if="!mapaMovido">
        <p class="text-sm font-semibold leading-snug text-on-surface dark:text-dark-on-surface">
          {{ resumo.titulo }}
        </p>
        <p v-if="resumo.subtitulo" class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ resumo.subtitulo }}
        </p>
      </template>
      <button
        v-if="mostrarBuscar"
        type="button"
        class="flex h-10 w-full items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
        :class="mapaMovido ? '' : 'mt-3'"
        :disabled="buscando || confirmando"
        @click="buscarEndereco"
      >
        {{ buscando ? 'Buscando endereço…' : 'Buscar endereço' }}
      </button>
    </div>

    <div class="relative mx-5 mt-3 min-h-52 flex-1 overflow-hidden rounded-2xl bg-surface-container dark:bg-dark-surface-container">
      <div ref="mapaEl" class="absolute inset-0 z-0" />
      <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <svg class="h-8 w-8 text-[#00C853] drop-shadow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
        </svg>
      </div>
      <div class="absolute left-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg bg-white shadow dark:bg-dark-surface-container">
        <button type="button" class="h-8 w-8 text-lg text-on-surface dark:text-dark-on-surface" aria-label="Aproximar" @click="aproximar">+</button>
        <button type="button" class="h-8 w-8 text-lg text-on-surface dark:text-dark-on-surface" aria-label="Afastar" @click="afastar">−</button>
      </div>
    </div>

    <p v-if="erro" class="px-5 pt-3 text-center text-sm text-red-500">{{ erro }}</p>

    <div class="flex flex-col gap-2 px-5 py-4">
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full bg-[#00C853] text-sm font-semibold text-white disabled:opacity-60"
        :disabled="!podeConfirmar"
        @click="confirmar"
      >
        {{ confirmando ? 'Confirmando…' : 'Confirmar localização' }}
      </button>
      <button
        type="button"
        class="flex h-12 items-center justify-center rounded-full border border-outline/30 text-sm font-medium text-on-surface dark:border-dark-outline/30 dark:text-dark-on-surface"
        @click="emit('voltar')"
      >
        Voltar
      </button>
    </div>
  </div>
</template>
