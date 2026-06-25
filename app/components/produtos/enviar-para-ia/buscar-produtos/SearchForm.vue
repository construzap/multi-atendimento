<script setup lang="ts">
import type { SearchFormPayload } from '#shared/types/vectorStore'

const props = defineProps<{
  loading?: boolean
  defaultEmpresaId?: number | null
}>()

const emit = defineEmits<{
  search: [payload: SearchFormPayload]
}>()

const query = ref('')
const limit = ref(10)
const empresaId = ref('')
const categorias = ref('')

watch(
  () => props.defaultEmpresaId,
  (id) => {
    if (id != null) empresaId.value = String(id)
  },
  { immediate: true },
)

function submit() {
  const q = query.value.trim()
  const emp = empresaId.value.trim()
  if (!q || !emp) return
  emit('search', {
    query: q,
    limit: limit.value,
    empresa_id: emp,
    categorias: categorias.value.trim(),
  })
}
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-gray-700">Consulta semântica</h2>

    <div class="mb-3 grid gap-3 sm:grid-cols-2">
      <label>
        <span class="mb-1 block text-xs text-gray-500">metadata.workspace_id</span>
        <input
          v-model="empresaId"
          type="text"
          inputmode="numeric"
          placeholder="Ex.: 9"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          :disabled="loading"
        />
      </label>
      <label>
        <span class="mb-1 block text-xs text-gray-500">metadata.termos_pesquisa (filtro opcional)</span>
        <input
          v-model="categorias"
          type="text"
          placeholder="Ex.: cimento telha"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          :disabled="loading"
        />
      </label>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex-1">
        <span class="mb-1 block text-xs text-gray-500">Texto da busca (embedding)</span>
        <input
          v-model="query"
          type="text"
          placeholder="Ex.: cimento 50kg, telha colonial..."
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          :disabled="loading"
          @keydown.enter.prevent="submit"
        />
      </label>

      <label class="w-full sm:w-28">
        <span class="mb-1 block text-xs text-gray-500">Resultados</span>
        <select
          v-model.number="limit"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          :disabled="loading"
        >
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </label>

      <button
        type="button"
        class="rounded-md bg-gray-800 px-5 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
        :disabled="loading || !query.trim() || !empresaId.trim()"
        @click="submit"
      >
        {{ loading ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>
  </section>
</template>
