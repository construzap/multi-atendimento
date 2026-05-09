<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Contato } from '#shared/types/contato'
import type { ContatosListResponse } from '#shared/types/contato'
import BaseInput from '~/components/BaseInput.vue'
import BaseButton from '~/components/BaseButton.vue'
import ContatosTabela from '~/components/contatos/ContatosTabela.vue'
import { mensagemErroFetch } from '~/stores/canais'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const canaisStore = useCanaisStore()
const { items: canaisItems } = storeToRefs(canaisStore)

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

const pending = ref(false)
const error = ref<string | null>(null)
const all = ref<Contato[]>([])
const filtro = ref('')

const filtered = computed(() => {
  const q = filtro.value.trim().toLowerCase()
  if (!q) return all.value
  return all.value.filter((c) => {
    const hay = `${c.name ?? ''} ${c.phone ?? ''} ${c.lid ?? ''} ${c.key ?? ''} ${c.id_canal ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
})

async function fetchContatos() {
  const wid = workspaceId.value
  if (wid == null) return

  pending.value = true
  error.value = null
  try {
    if (!canaisItems.value.length) {
      await canaisStore.fetchCanais(wid).catch(() => {
        /* erro tratado abaixo */
      })
    }

    const ids = (canaisItems.value ?? []).map((c) => c.id).filter((n) => typeof n === 'number')
    if (!ids.length) {
      all.value = []
      return
    }

    const res = await $fetch<ContatosListResponse>('/api/contatos', {
      method: 'GET',
      query: { canais: ids.join(',') },
    })
    all.value = res.data ?? []
  } catch (err: unknown) {
    const msg = mensagemErroFetch(err, 'Não foi possível carregar os contatos.')
    error.value = msg
    toast.error(msg, { duration: 8000 })
  } finally {
    pending.value = false
  }
}

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

      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <BaseInput
          id="contatos-busca"
          v-model="filtro"
          type="search"
          name="contatos-busca"
          placeholder="Buscar por nome, telefone, LID…"
          autocomplete="off"
          class="sm:w-80"
        />
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          :loading="pending"
          :disabled="pending"
          @click="fetchContatos"
        >
          Atualizar
        </BaseButton>
      </div>
    </header>

    <ContatosTabela :items="filtered" :pending="pending" :error="error" />
  </div>
</template>

