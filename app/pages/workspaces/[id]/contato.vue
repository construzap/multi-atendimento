<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import ContatosTabela from '~/components/contatos/ContatosTabela.vue'
import BotoesAcaoContatos from '~/components/contatos/BotoesAcaoContatos.vue'
import FerramentaImportarContato from '~/components/contatos/FerramentaImportarContato.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useContatosStore } from '~/stores/contatos'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const contatosStore = useContatosStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

const ferramentaImportarContatoRef = ref<{ abrirSeletorImportacao: () => void } | null>(null)

function aoClicarImportar() {
  ferramentaImportarContatoRef.value?.abrirSeletorImportacao()
}

async function fetchContatos() {
  const wid = workspaceId.value
  if (wid == null) return

  try {
    await contatosStore.fetchPagina(wid)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os contatos.'), { duration: 8000 })
  }
}

watch(workspaceId, (wid, prev) => {
  if (prev !== undefined && wid !== prev) {
    contatosStore.reset()
    if (wid != null) {
      void fetchContatos()
    }
  }
})

onMounted(() => {
  fetchContatos().catch(() => {})
})
</script>

<template>
  <div class="min-h-[100dvh] w-full p-4 md:p-6">
    <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="truncate font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">Contatos</h1>
        <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Lista de contatos a partir das conversas dos seus canais.
        </p>
      </div>

      <BotoesAcaoContatos @importar="aoClicarImportar" />
    </header>

    <FerramentaImportarContato ref="ferramentaImportarContatoRef" :workspace-id="workspaceId" />

    <ContatosTabela />
  </div>
</template>
