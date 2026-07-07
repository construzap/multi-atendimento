<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import PromptSelecionado from '~/components/admin/prompt/PromptSelecionado.vue'
import { mensagemErroFetch } from '~/stores/canais'

const adminStore = useAdminStore()
const {
  selectedWorkspaceId,
  promptItens,
  promptsPending,
  promptsLoaded,
  promptsError,
  promptModalAberto,
  promptEmEdicaoId,
  promptSalvando,
} = storeToRefs(adminStore)

const carregandoPrompts = computed(() => promptsPending.value && !promptsLoaded.value)

function selecionarPrompt(id: string) {
  adminStore.abrirModalPrompt(id)
}

function criarPrompt() {
  if (!selectedWorkspaceId.value) {
    toast.warning('Selecione um workspace na barra lateral.')
    return
  }
  adminStore.abrirModalPromptNovo()
}

function promptSelecionado(id: string) {
  return promptEmEdicaoId.value === id
}

async function onSalvar(payload: { titulo: string; conteudo: string; principal: boolean; tipo: string }) {
  try {
    const isNovo = await adminStore.salvarPrompt(payload)
    toast.success(isNovo ? 'Prompt criado com sucesso.' : 'Prompt atualizado com sucesso.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o prompt.'))
  }
}

async function onExcluir() {
  try {
    await adminStore.excluirPromptAtual()
    toast.success('Prompt excluído.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir o prompt.'))
  }
}

function formatarData(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low">
      <div class="flex items-center justify-between gap-3 border-b border-outline/40 px-4 py-4 dark:border-dark-outline/40">
        <div>
          <h3 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
            Prompts
          </h3>
          <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            <template v-if="!selectedWorkspaceId">
              Selecione um workspace na barra lateral
            </template>
            <template v-else-if="carregandoPrompts">
              Carregando...
            </template>
            <template v-else>
              {{ promptItens.length }} cadastrado(s) — clique para editar
            </template>
          </p>
        </div>
        <BaseButton
          id="btn-novo-prompt"
          variant="secondary"
          size="sm"
          :block="false"
          :disabled="!selectedWorkspaceId || carregandoPrompts || promptSalvando"
          @click="criarPrompt"
        >
          + Novo
        </BaseButton>
      </div>

      <div
        v-if="!selectedWorkspaceId"
        class="px-6 py-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Escolha um workspace na barra lateral para gerenciar os prompts.
      </div>

      <div
        v-else-if="carregandoPrompts"
        class="flex items-center justify-center gap-2 px-6 py-16 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando prompts...
      </div>

      <div
        v-else-if="promptsError"
        class="px-6 py-10 text-center text-sm text-danger dark:text-dark-danger"
      >
        {{ promptsError }}
      </div>

      <div
        v-else-if="!promptItens.length"
        class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      >
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M9.5 7.5H14.5M9.5 11H13M7 3h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2-3.5 2V5a2 2 0 0 1 2-2z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Nenhum prompt criado. Clique em &ldquo;Novo&rdquo; para começar.
        </p>
        <BaseButton
          id="btn-criar-primeiro-prompt"
          variant="primary"
          size="sm"
          class="max-w-xs"
          @click="criarPrompt"
        >
          Criar primeiro prompt
        </BaseButton>
      </div>

      <ul v-else class="divide-y divide-outline/30 dark:divide-dark-outline/30">
        <li v-for="p in promptItens" :key="p.id">
          <button
            type="button"
            class="flex w-full flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-surface-container-high/70 dark:hover:bg-dark-surface-container-high/50"
            :class="promptSelecionado(p.id) ? 'bg-primary-50/80 dark:bg-primary-900/20' : ''"
            @click="selecionarPrompt(p.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="line-clamp-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ p.titulo }}
              </p>
              <span
                v-if="p.principal"
                class="shrink-0 rounded-md bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                Principal
              </span>
            </div>
            <p class="line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ p.conteudo || 'Sem conteúdo' }}
            </p>
            <p class="text-[10px] text-on-surface-variant/70 dark:text-dark-on-surface-variant/70">
              Atualizado {{ formatarData(p.atualizadoEm) }}
            </p>
          </button>
        </li>
      </ul>
    </div>

    <PromptSelecionado
      v-if="promptModalAberto"
      :salvando="promptSalvando"
      @close="adminStore.fecharModalPrompt()"
      @save="onSalvar"
      @delete="onExcluir"
    />
  </div>
</template>
