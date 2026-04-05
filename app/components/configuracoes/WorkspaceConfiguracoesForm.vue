<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import WorkspaceDescricaoRichText from '~/components/configuracoes/WorkspaceDescricaoRichText.vue'

const route = useRoute()
const workspaces = useWorkspacesStore()

const workspaceId = computed(() => workspaces.currentWorkspaceId ?? String(route.params.id ?? ''))

const workspace = computed(() => {
  const idNum = Number(workspaceId.value)
  if (!Number.isFinite(idNum)) return null
  return workspaces.items.find((w) => w.id === idNum) ?? null
})

const nome = ref('')
const descricao = ref('')
const modalExcluirAberto = ref(false)

watch(
  () => workspace.value,
  (w) => {
    nome.value = w?.nome ?? ''
    descricao.value = w?.descricao ?? ''
  },
  { immediate: true }
)

const createdAtLabel = computed(() => {
  const raw = workspace.value?.created_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
})

/** HTML vazio do editor → null para a API */
function descricaoParaApi(html: string): string | null {
  const texto = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.length ? html.trim() : null
}

async function onSalvar() {
  const w = workspace.value
  if (!w) {
    toast.error('Workspace não encontrado.')
    return
  }

  const nomeTrim = nome.value.trim()
  if (!nomeTrim) {
    toast.warning('Informe o nome.')
    return
  }

  try {
    await workspaces.updateWorkspace(w.id, {
      nome: nomeTrim,
      descricao: descricaoParaApi(descricao.value)
    })
    toast.success('Workspace atualizado com sucesso.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao salvar.')
  }
}

function abrirModalExcluir() {
  if (!workspace.value) {
    toast.error('Workspace não encontrado.')
    return
  }
  modalExcluirAberto.value = true
}

async function confirmarExclusaoWorkspace() {
  const w = workspace.value
  if (!w) {
    modalExcluirAberto.value = false
    return
  }

  try {
    await workspaces.deleteWorkspace(w.id)
    modalExcluirAberto.value = false
    toast.success('Workspace removido.')
    await navigateTo('/')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao remover workspace.')
  }
}
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Workspace
          </h3>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Edite as informações do seu workspace
          </p>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div class="w-full sm:w-40">
            <BaseButton
              id="btn-ws-config-deletar"
              type="button"
              variant="secondary"
              :disabled="workspaces.pending || !workspace"
              @click="abrirModalExcluir"
            >
              Deletar
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6">
      <div
        v-if="!workspace"
        class="rounded-xl border border-outline/40 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        Workspace não encontrado no estado atual.
      </div>

      <form v-else class="space-y-5" @submit.prevent="onSalvar">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-nome">
            Nome
          </label>
          <BaseInput id="ws-config-nome" v-model="nome" type="text" name="nome" autocomplete="off">
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 6h16M4 12h10M4 18h16" stroke-linecap="round" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-descricao">
            Descrição
          </label>
          <ClientOnly>
            <WorkspaceDescricaoRichText id="ws-config-descricao" v-model="descricao" />
            <template #fallback>
              <div
                class="min-h-[180px] rounded-xl border border-gray-200 bg-gray-50 dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
                aria-hidden="true"
              />
            </template>
          </ClientOnly>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-created-at">
            Data de criação
          </label>
          <BaseInput
            id="ws-config-created-at"
            :model-value="createdAtLabel"
            type="text"
            name="created_at"
            readonly
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div class="pt-2">
          <BaseButton id="btn-ws-config-salvar" type="submit" :disabled="workspaces.pending">
            {{ workspaces.pending ? 'Salvando...' : 'Salvar alterações' }}
          </BaseButton>
        </div>
      </form>
    </div>

    <ModalAlerta
      v-model:open="modalExcluirAberto"
      title="Excluir workspace"
      texto="Tem certeza que deseja excluir este workspace? Ele será ocultado da sua lista."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="workspaces.pending"
      :cancelar-desabilitado="workspaces.pending"
      :mostrar-fechar="!workspaces.pending"
      @confirmar="confirmarExclusaoWorkspace"
    />
  </section>
</template>
