<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseInput from '~/components/BaseInput.vue'
import BaseButton from '~/components/BaseButton.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useContatosStore } from '~/stores/contatos'

const contatosStore = useContatosStore()
const { q: termoAplicado, pending } = storeToRefs(contatosStore)

const emit = defineEmits<{
  importar: []
}>()

const route = useRoute()
const busca = ref('')

watch(
  termoAplicado,
  (valor) => {
    busca.value = valor
  },
  { immediate: true },
)

function parseWorkspaceId(): number | null {
  const raw = route.params.id
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const mostrarPesquisar = computed(() => busca.value.trim() !== (termoAplicado.value ?? '').trim())

async function dispararPesquisa() {
  const wid = parseWorkspaceId()
  if (wid == null) return

  const termo = busca.value.trim()
  if (!termo) {
    contatosStore.limparBusca()
    return
  }

  try {
    await contatosStore.fetchPagina(wid, {
      q: termo,
      force: true,
    })
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível buscar os contatos.'), { duration: 8000 })
  }
}

async function atualizarContatos() {
  const wid = parseWorkspaceId()
  if (wid == null) return

  try {
    if (contatosStore.emModoBusca) {
      await contatosStore.fetchPagina(wid, {
        q: contatosStore.busca.q,
        force: true,
      })
    } else {
      await contatosStore.fetchPagina(wid, { force: true })
    }
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar os contatos.'), { duration: 8000 })
  }
}

function onBuscaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    void dispararPesquisa()
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
    <BaseButton
      type="button"
      variant="success"
      size="sm"
      :block="false"
      @click="emit('importar')"
    >
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">file_upload</span>
        Importar
      </span>
    </BaseButton>

    <div class="flex min-w-0 items-stretch gap-2 sm:w-auto">
      <BaseInput
        id="contatos-busca"
        v-model="busca"
        type="search"
        name="contatos-busca"
        placeholder="Buscar por nome, telefone, LID, grupo…"
        autocomplete="off"
        class="sm:w-80"
        @keydown="onBuscaKeydown"
      />
      <BaseButton
        v-show="mostrarPesquisar"
        type="button"
        variant="primary"
        size="sm"
        :block="false"
        class="shrink-0 self-stretch sm:self-center"
        @click="dispararPesquisa"
      >
        <span class="inline-flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">search</span>
          Pesquisar
        </span>
      </BaseButton>
    </div>

    <BaseButton
      type="button"
      variant="secondary"
      size="sm"
      :block="false"
      :loading="pending"
      :disabled="pending"
      @click="atualizarContatos"
    >
      Atualizar
    </BaseButton>
  </div>
</template>
