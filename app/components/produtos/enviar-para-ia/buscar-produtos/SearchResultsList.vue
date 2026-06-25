<script setup lang="ts">
import type { SearchHit } from '#shared/types/vectorStore'

defineProps<{
  hits: SearchHit[]
  loading?: boolean
  error?: string | null
  query?: string
  filters?: { empresa_id: string; categorias: string } | null
  searched?: boolean
}>()

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function tituloFromMeta(meta: SearchHit['metadata'], content: string): string {
  const nomeMatch = content.match(/Nome do produto:\s*([^|]+)/i)
  if (nomeMatch?.[1]?.trim()) return nomeMatch[1].trim()

  if (meta && typeof meta === 'object') {
    const rec = meta as Record<string, unknown>
    const termo = rec.termo_pesquisa
    if (termo != null && String(termo).trim()) return `Termo ${termo}`
  }

  return 'Produto'
}

function metaLabel(meta: SearchHit['metadata']): string | null {
  if (!meta || typeof meta !== 'object') return null
  const rec = meta as Record<string, unknown>
  const parts: string[] = []
  if (rec.workspace_id != null) parts.push(`workspace ${rec.workspace_id}`)
  const termos = rec.termos_pesquisa ?? rec.categorias
  if (termos != null && String(termos).trim()) parts.push(`termos ${termos}`)
  return parts.length ? parts.join(' · ') : null
}
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-gray-700">Resultados</h2>

    <p v-if="filters && searched && !loading" class="mb-3 text-xs text-gray-500">
      Filtros:
      <code class="text-gray-600">workspace_id={{ filters.empresa_id }}</code>
      <template v-if="filters.categorias">
        · <code class="text-gray-600">termos_pesquisa~="{{ filters.categorias }}"</code>
      </template>
    </p>

    <p v-if="loading" class="text-sm text-gray-500">Buscando na vector store…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="searched && !hits.length" class="text-sm text-gray-500">
      Nenhum resultado para <strong class="font-medium text-gray-700">"{{ query }}"</strong>.
    </p>
    <p v-else-if="!searched" class="text-sm text-gray-500">
      Digite uma consulta e clique em Buscar.
    </p>

    <ul v-else class="space-y-3">
      <li
        v-for="(hit, index) in hits"
        :key="hit.id"
        class="rounded-md border border-gray-100 bg-gray-50 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-gray-400">
              #{{ index + 1 }}
            </p>
            <p class="mt-1 font-medium text-gray-900">
              {{ tituloFromMeta(hit.metadata, hit.content) }}
            </p>
            <p v-if="metaLabel(hit.metadata)" class="mt-0.5 text-xs text-gray-500">
              {{ metaLabel(hit.metadata) }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
          >
            {{ (hit.similarity * 100).toFixed(1) }}%
          </span>
        </div>

        <p
          class="mt-3 whitespace-pre-wrap text-sm text-gray-700"
          :class="expandedIds.has(hit.id) ? '' : 'line-clamp-3'"
        >
          {{ hit.content }}
        </p>

        <button
          type="button"
          class="mt-2 text-xs font-medium text-blue-600 hover:underline"
          @click="toggleExpand(hit.id)"
        >
          {{ expandedIds.has(hit.id) ? 'Recolher' : 'Ver conteúdo completo' }}
        </button>
      </li>
    </ul>
  </section>
</template>
