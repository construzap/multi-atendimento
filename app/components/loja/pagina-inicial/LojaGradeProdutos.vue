<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaBusca from '~/components/loja/pagina-inicial/LojaBusca.vue'
import LojaCardProduto from '~/components/loja/pagina-inicial/LojaCardProduto.vue'
import LojaCategorias from '~/components/loja/pagina-inicial/LojaCategorias.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  nomeLoja?: string | null
}>()

const loja = useLojaWorkspaceStore()
const { termos, produtos, has_more, loadingMais } = storeToRefs(loja)

const busca = ref('')
const categoriaAtiva = ref<number | null>(null)
const scrollingProgramatico = ref(false)
const stickyRef = ref<HTMLElement | null>(null)
const sentinelaRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let sentinelaObserver: IntersectionObserver | null = null
let unlockTimer: ReturnType<typeof setTimeout> | null = null

const buscaNorm = computed(() => busca.value.trim().toLowerCase())

const produtosFiltrados = computed(() => {
  const q = buscaNorm.value
  if (!q) return produtos.value
  return produtos.value.filter((p) => {
    const nome = p.nome.toLowerCase()
    const desc = (p.descricao ?? '').toLowerCase()
    return nome.includes(q) || desc.includes(q)
  })
})

const secoes = computed(() => {
  const byCat = new Map<number, typeof produtos.value>()
  for (const p of produtosFiltrados.value) {
    const list = byCat.get(p.termo_id) ?? []
    list.push(p)
    byCat.set(p.termo_id, list)
  }

  return termos.value
    .map((cat) => ({
      ...cat,
      produtos: byCat.get(cat.id) ?? [],
    }))
    .filter((s) => s.produtos.length > 0)
})

const placeholderBusca = computed(() => {
  const nome = props.nomeLoja?.trim()
  return nome ? `Buscar em ${nome}` : 'Buscar no cardápio'
})

function secaoId(termoId: number) {
  return `loja-cat-${termoId}`
}

function pedirMais() {
  if (!has_more.value) return
  void loja.carregarMais()
}

function offsetAbaixoDoMenu(): number {
  const sticky = stickyRef.value
  if (!sticky) return 200
  return Math.ceil(sticky.getBoundingClientRect().bottom) + 12
}

async function irParaCategoria(id: number) {
  categoriaAtiva.value = id
  scrollingProgramatico.value = true
  if (unlockTimer) clearTimeout(unlockTimer)

  await nextTick()
  const titulo = document.getElementById(secaoId(id))
  if (titulo) {
    const top = titulo.getBoundingClientRect().top + window.scrollY - offsetAbaixoDoMenu()
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    titulo.focus({ preventScroll: true })
  }

  unlockTimer = setTimeout(() => {
    scrollingProgramatico.value = false
  }, 1000)
}

function setupObserver() {
  observer?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return

  observer = new IntersectionObserver(
    (entries) => {
      if (scrollingProgramatico.value) return
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      const first = visible[0]
      if (!first?.target?.id) return
      const raw = first.target.id.replace(/^loja-cat-/, '')
      const id = Number.parseInt(raw, 10)
      if (Number.isFinite(id)) categoriaAtiva.value = id
    },
    {
      root: null,
      rootMargin: '-140px 0px -55% 0px',
      threshold: [0.1, 0.25, 0.5],
    },
  )

  for (const s of secoes.value) {
    const el = document.getElementById(secaoId(s.id))
    if (el) observer.observe(el)
  }
}

function setupSentinela() {
  sentinelaObserver?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  const el = sentinelaRef.value
  if (!el) return

  sentinelaObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) pedirMais()
    },
    { root: null, rootMargin: '240px 0px', threshold: 0 },
  )
  sentinelaObserver.observe(el)
}

watch(
  secoes,
  async (list) => {
    if (list.length && !list.some((s) => s.id === categoriaAtiva.value)) {
      categoriaAtiva.value = list[0]!.id
    }
    await nextTick()
    setupObserver()
    setupSentinela()
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  setupObserver()
  setupSentinela()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  sentinelaObserver?.disconnect()
  if (unlockTimer) clearTimeout(unlockTimer)
})
</script>

<template>
  <div>
    <div
      ref="stickyRef"
      class="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 border-b border-outline/30 bg-surface-container-lowest/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/90 dark:border-dark-outline/30 dark:bg-dark-surface-container-low/95"
    >
      <div class="mx-auto max-w-lg px-4 py-3 md:max-w-2xl">
        <LojaBusca v-model="busca" :placeholder="placeholderBusca" />
      </div>
      <div class="mx-auto max-w-lg md:max-w-2xl">
        <LojaCategorias
          v-if="termos.length"
          :categorias="termos"
          :modelo-ativo="categoriaAtiva"
          @selecionar="irParaCategoria"
          @proximodo-fim="pedirMais"
        />
      </div>
    </div>

    <div class="mx-auto max-w-lg px-4 pb-24 md:max-w-2xl">
      <p
        v-if="!secoes.length"
        class="py-12 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum produto encontrado.
      </p>

      <section
        v-for="secao in secoes"
        :key="secao.id"
        class="pt-6 outline-none"
      >
        <h2
          :id="secaoId(secao.id)"
          tabindex="-1"
          class="mb-3 text-xl font-bold tracking-tight text-on-surface outline-none dark:text-dark-on-surface"
        >
          {{ secao.nome }}
        </h2>
        <LojaCardProduto
          v-for="produto in secao.produtos"
          :key="`${produto.termo_id}-${produto.id}`"
          :produto="produto"
        />
      </section>

      <div ref="sentinelaRef" class="h-8" aria-hidden="true" />

      <p
        v-if="loadingMais"
        class="flex items-center justify-center gap-2 py-6 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-outline/30 border-t-primary-500 dark:border-dark-outline/40 dark:border-t-dark-primary"
          aria-hidden="true"
        />
        Carregando mais…
      </p>
    </div>
  </div>
</template>
