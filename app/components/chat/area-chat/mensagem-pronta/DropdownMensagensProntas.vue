<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { MensagemProntaListaItem } from '#shared/types/mensagensProntas'
import { useMensagensProntasStore } from '~/stores/mensagensProntas'
import { useWorkspacesStore } from '~/stores/workspaces'
import { toast } from 'vue-sonner'
import { mensagemErroFetch } from '~/stores/canais'

const emit = defineEmits<{
  voltar: []
  criar: []
  editar: [item: MensagemProntaListaItem]
  selecionar: [item: MensagemProntaListaItem]
}>()

const props = withDefaults(
  defineProps<{
    /** `slash` = atalho do input `/` (botão Fechar em vez de Voltar). */
    modo?: 'menu' | 'slash'
  }>(),
  { modo: 'menu' },
)

const workspaces = useWorkspacesStore()
const store = useMensagensProntasStore()
const { listaDropdown, pending, error } = storeToRefs(store)

const excluindoId = ref<string | null>(null)

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId
  if (raw == null || !String(raw).trim()) return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

onMounted(async () => {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await store.ensureLista(wid)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar as mensagens prontas.'))
  }
})

function onEditar(item: MensagemProntaListaItem, ev: Event) {
  ev.stopPropagation()
  ev.preventDefault()
  emit('editar', item)
}

async function onExcluir(item: MensagemProntaListaItem, ev: Event) {
  ev.stopPropagation()
  ev.preventDefault()
  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Selecione um workspace.')
    return
  }
  if (!window.confirm(`Excluir a mensagem pronta “${item.titulo}”?`)) return

  excluindoId.value = item.id
  try {
    await store.excluirSequencia(wid, item.id)
    toast.success('Mensagem pronta excluída.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir a mensagem pronta.'))
  } finally {
    excluindoId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      type="button"
      class="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
      @click="emit('voltar')"
    >
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
        {{ props.modo === 'slash' ? 'close' : 'arrow_back' }}
      </span>
      {{ props.modo === 'slash' ? 'Fechar' : 'Voltar' }}
    </button>
    <button
      type="button"
      role="menuitem"
      class="mb-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/10 dark:border-primary/50 dark:bg-primary/10"
      @click="emit('criar')"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
      Criar nova
    </button>
    <div class="mx-1 border-t border-outline/25 dark:border-dark-outline/25" />
    <p
      class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Mensagens prontas
    </p>

    <p
      v-if="pending && !listaDropdown.length"
      class="px-3 py-4 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Carregando…
    </p>

    <template v-else>
      <div
        v-for="item in listaDropdown"
        :key="item.id"
        class="group flex items-stretch gap-0.5 rounded-xl transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
      >
        <button
          type="button"
          role="menuitem"
          class="min-w-0 flex-1 flex flex-col gap-0.5 px-3 py-2.5 text-left"
          @click="emit('selecionar', item)"
        >
          <span class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ item.titulo }}
          </span>
          <span class="line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ item.texto }}
          </span>
        </button>
        <div class="flex shrink-0 flex-col justify-center gap-0.5 pr-1.5">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-primary dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
            aria-label="Editar"
            title="Editar"
            @click="onEditar(item, $event)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
          </button>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-dark-on-surface-variant dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            aria-label="Excluir"
            title="Excluir"
            :disabled="excluindoId === item.id"
            @click="onExcluir(item, $event)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>
      <p
        v-if="!listaDropdown.length"
        class="px-3 py-4 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ error || 'Nenhuma mensagem pronta ainda.' }}
      </p>
    </template>
  </div>
</template>
