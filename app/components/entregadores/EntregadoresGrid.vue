<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { EntregadorListaItem } from '#shared/types/entregadores'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
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
const formPremium = ref(false)

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
  formPremium.value = false
  modalAberto.value = true
}

function abrirEditar(e: EntregadorListaItem) {
  editando.value = e
  formCodigo.value = e.codigo
  formNome.value = e.nome
  formAtivo.value = e.ativo
  formPremium.value = e.entregador_premium === true
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
        entregador_premium: formPremium.value,
      })
      toast.success('Entregador atualizado')
    } else {
      await store.create({
        workspaceId: props.workspaceId,
        codigo: formCodigo.value,
        nome: formNome.value,
        ativo: formAtivo.value,
        entregador_premium: formPremium.value,
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

async function alternarPremium(e: EntregadorListaItem) {
  try {
    await store.update({
      workspaceId: props.workspaceId,
      id: e.id,
      entregador_premium: !e.entregador_premium,
    })
    toast.success(
      e.entregador_premium ? 'Premium desativado' : 'Entregador premium ativado',
    )
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o premium.'))
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="w-full sm:max-w-md">
        <BaseInput
          v-model="pesquisa"
          type="search"
          name="pesquisa-entregadores"
          placeholder="Buscar por nome ou código…"
          autocomplete="off"
        />
      </div>
      <BaseButton
        type="button"
        variant="primary"
        :block="false"
        @click="abrirCriar"
      >
        Novo entregador
      </BaseButton>
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
            <p class="flex min-w-0 items-center gap-1.5">
              <span class="truncate font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
                {{ e.nome }}
              </span>
              <span
                v-if="e.entregador_premium"
                class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              >
                Premium
              </span>
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
        <div class="mt-3 flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
            Entregador premium
          </span>
          <button
            type="button"
            role="switch"
            :aria-checked="e.entregador_premium"
            :aria-label="e.entregador_premium ? 'Desativar premium' : 'Ativar premium'"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            :class="
              e.entregador_premium
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-outline/40 dark:bg-dark-outline/50'
            "
            @click="alternarPremium(e)"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              :class="e.entregador_premium ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>
        </div>
        <div class="mt-4 flex gap-2">
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            :block="false"
            class="flex-1"
            @click="abrirEditar(e)"
          >
            Editar
          </BaseButton>
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            :block="false"
            class="flex-1"
            @click="alternarAtivo(e)"
          >
            {{ e.ativo ? 'Desativar' : 'Ativar' }}
          </BaseButton>
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
            <div>
              <label
                for="entregador-codigo"
                class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
              >
                Código
              </label>
              <BaseInput
                id="entregador-codigo"
                v-model="formCodigo"
                maxlength="40"
                placeholder="ENT-042"
                autocomplete="off"
                :disabled="salvando"
              />
            </div>
            <div>
              <label
                for="entregador-nome"
                class="mb-1.5 block text-sm font-medium text-on-surface dark:text-dark-on-surface"
              >
                Nome
              </label>
              <BaseInput
                id="entregador-nome"
                v-model="formNome"
                maxlength="200"
                placeholder="Nome do entregador"
                autocomplete="off"
                :disabled="salvando"
              />
            </div>
            <label class="flex items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface">
              <input
                v-model="formAtivo"
                type="checkbox"
                class="h-4 w-4 rounded border-outline-variant"
                :disabled="salvando"
              />
              Ativo
            </label>
            <label class="flex items-center justify-between gap-3 text-sm text-on-surface dark:text-dark-on-surface">
              <span>Entregador premium</span>
              <span class="relative inline-flex items-center">
                <input
                  v-model="formPremium"
                  type="checkbox"
                  class="peer sr-only"
                  role="switch"
                  :disabled="salvando"
                  aria-label="Entregador premium"
                />
                <span
                  class="relative h-5 w-9 rounded-full bg-outline/40 transition-colors peer-checked:bg-amber-500 peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300 dark:bg-dark-outline/50 dark:peer-checked:bg-amber-400"
                  aria-hidden="true"
                >
                  <span
                    class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    :class="formPremium ? 'translate-x-4' : 'translate-x-0'"
                  />
                </span>
              </span>
            </label>
            <div class="flex gap-2 pt-2">
              <BaseButton
                type="button"
                variant="secondary"
                size="sm"
                :block="false"
                class="flex-1"
                :disabled="salvando"
                @click="fecharModal"
              >
                Cancelar
              </BaseButton>
              <BaseButton
                type="submit"
                variant="primary"
                size="sm"
                :block="false"
                class="flex-1"
                :disabled="salvando || !formCodigo.trim() || !formNome.trim()"
              >
                {{ salvando ? 'Salvando…' : 'Salvar' }}
              </BaseButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
