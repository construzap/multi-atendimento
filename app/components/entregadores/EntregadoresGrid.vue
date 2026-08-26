<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { EntregadorListaItem } from '#shared/types/entregadores'
import { useEntregadoresStore } from '~/stores/entregadores'
import { mensagemErroFetch } from '~/stores/canais'

const props = defineProps<{
  workspaceId: number
}>()

const store = useEntregadoresStore()
const { items, listPending, listError } = storeToRefs(store)

const pesquisa = ref('')
const modalAberto = ref(false)
const editando = ref<EntregadorListaItem | null>(null)
const salvando = ref(false)

const formCodigo = ref('')
const formNome = ref('')
const formAtivo = ref(true)

watch(
  () => props.workspaceId,
  (id) => {
    pesquisa.value = ''
    if (Number.isFinite(id) && id >= 1) {
      void store.ensureListLoaded(id)
    } else {
      store.reset()
    }
  },
  { immediate: true },
)

const itensFiltrados = computed(() => {
  const q = pesquisa.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((e) => {
    return (
      e.nome.toLowerCase().includes(q) ||
      e.codigo.toLowerCase().includes(q) ||
      String(e.id).includes(q)
    )
  })
})

function abrirCriar() {
  editando.value = null
  formCodigo.value = ''
  formNome.value = ''
  formAtivo.value = true
  modalAberto.value = true
}

function abrirEditar(e: EntregadorListaItem) {
  editando.value = e
  formCodigo.value = e.codigo
  formNome.value = e.nome
  formAtivo.value = e.ativo
  modalAberto.value = true
}

function fecharModal() {
  if (salvando.value) return
  modalAberto.value = false
  editando.value = null
}

async function salvar() {
  if (salvando.value) return
  salvando.value = true
  try {
    if (editando.value) {
      await store.update({
        workspaceId: props.workspaceId,
        id: editando.value.id,
        codigo: formCodigo.value,
        nome: formNome.value,
        ativo: formAtivo.value,
      })
      toast.success('Entregador atualizado')
    } else {
      await store.create({
        workspaceId: props.workspaceId,
        codigo: formCodigo.value,
        nome: formNome.value,
        ativo: formAtivo.value,
      })
      toast.success('Entregador criado')
    }
    modalAberto.value = false
    editando.value = null
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o entregador.'))
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(e: EntregadorListaItem) {
  try {
    await store.update({
      workspaceId: props.workspaceId,
      id: e.id,
      ativo: !e.ativo,
    })
    toast.success(e.ativo ? 'Entregador desativado' : 'Entregador ativado')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o status.'))
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative w-full sm:max-w-md">
        <input
          v-model="pesquisa"
          type="search"
          name="pesquisa-entregadores"
          placeholder="Buscar por nome ou código…"
          class="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 pl-4 pr-4 text-sm outline-none focus:border-primary-500 dark:border-dark-outline-variant/40 dark:bg-dark-surface dark:text-dark-on-surface"
        />
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        @click="abrirCriar"
      >
        Novo entregador
      </button>
    </div>

    <p
      v-if="listError"
      class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      {{ listError }}
    </p>

    <div
      v-if="listPending && items.length === 0"
      class="rounded-2xl border border-dashed border-outline-variant/50 p-10 text-center text-sm text-on-surface-variant"
    >
      Carregando…
    </div>

    <div
      v-else-if="itensFiltrados.length === 0"
      class="rounded-2xl border border-dashed border-outline-variant/50 p-10 text-center text-sm text-on-surface-variant"
    >
      Nenhum entregador cadastrado.
    </div>

    <ul
      v-else
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="e in itensFiltrados"
        :key="e.id"
        class="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm dark:border-dark-outline-variant/30 dark:bg-dark-surface"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
              {{ e.nome }}
            </p>
            <p class="mt-0.5 font-mono text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ e.codigo }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="
              e.ativo
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            "
          >
            {{ e.ativo ? 'Ativo' : 'Inativo' }}
          </span>
        </div>
        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container dark:border-dark-outline-variant/40 dark:text-dark-on-surface"
            @click="abrirEditar(e)"
          >
            Editar
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container dark:border-dark-outline-variant/40 dark:text-dark-on-surface"
            @click="alternarAtivo(e)"
          >
            {{ e.ativo ? 'Desativar' : 'Ativar' }}
          </button>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="modalAberto"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        @click.self="fecharModal"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-surface"
          role="dialog"
          aria-modal="true"
        >
          <h2 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            {{ editando ? 'Editar entregador' : 'Novo entregador' }}
          </h2>
          <form class="mt-4 space-y-3" @submit.prevent="salvar">
            <label class="block">
              <span class="mb-1 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
                Código
              </span>
              <input
                v-model="formCodigo"
                type="text"
                required
                maxlength="40"
                placeholder="ENT-042"
                class="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-dark-outline-variant/40 dark:bg-dark-background dark:text-dark-on-surface"
                :disabled="salvando"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-medium text-on-surface dark:text-dark-on-surface">
                Nome
              </span>
              <input
                v-model="formNome"
                type="text"
                required
                maxlength="200"
                placeholder="Nome do entregador"
                class="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-dark-outline-variant/40 dark:bg-dark-background dark:text-dark-on-surface"
                :disabled="salvando"
              />
            </label>
            <label class="flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface">
              <input
                v-model="formAtivo"
                type="checkbox"
                class="h-4 w-4 rounded border-outline-variant"
                :disabled="salvando"
              />
              Ativo
            </label>
            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class="flex-1 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-sm font-semibold dark:border-dark-outline-variant/40 dark:text-dark-on-surface"
                :disabled="salvando"
                @click="fecharModal"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                :disabled="salvando || !formCodigo.trim() || !formNome.trim()"
              >
                {{ salvando ? 'Salvando…' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
