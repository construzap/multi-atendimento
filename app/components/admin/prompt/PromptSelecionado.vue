<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalEditor_prompt from '~/components/admin/prompt/ModalEditor_prompt.vue'
import { PROMPT_TIPOS_OPCOES, PROMPT_WORKSPACE_TIPO_DEFAULT } from '~/components/admin/prompt/types'

const props = withDefaults(
  defineProps<{
    salvando?: boolean
  }>(),
  {
    salvando: false,
  },
)

const emit = defineEmits<{
  close: []
  save: [payload: { titulo: string; conteudo: string; principal: boolean; tipo: string }]
  delete: []
}>()

const adminStore = useAdminStore()
const { promptEmEdicao } = storeToRefs(adminStore)

const tituloPainel = computed(() =>
  promptEmEdicao.value?.isNovo ? 'Novo prompt' : 'Editar prompt',
)

const titulo = ref('')
const conteudo = ref('')
const tipo = ref(PROMPT_WORKSPACE_TIPO_DEFAULT)
const principal = ref(false)
const modalConteudoAberto = ref(false)

watch(
  promptEmEdicao,
  (p) => {
    if (!p) return
    titulo.value = p.titulo
    conteudo.value = p.conteudo
    tipo.value = p.tipo || PROMPT_WORKSPACE_TIPO_DEFAULT
    principal.value = p.principal
    modalConteudoAberto.value = false
  },
  { immediate: true },
)

function fechar() {
  modalConteudoAberto.value = false
  emit('close')
}

function salvar() {
  if (props.salvando) return
  emit('save', {
    titulo: titulo.value.trim() || 'Sem título',
    conteudo: conteudo.value,
    principal: principal.value,
    tipo: tipo.value.trim() || PROMPT_WORKSPACE_TIPO_DEFAULT,
  })
}

function excluir() {
  if (props.salvando || promptEmEdicao.value?.isNovo) return
  emit('delete')
}

function abrirModalConteudo() {
  if (props.salvando) return
  modalConteudoAberto.value = true
}
</script>

<template>
  <section
    v-if="promptEmEdicao"
    class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    aria-label="Prompt selecionado"
  >
    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-outline/40 px-4 py-4 dark:border-dark-outline/40">
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-primary"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M9.5 7.5H14.5M9.5 11H13M7 3h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2-3.5 2V5a2 2 0 0 1 2-2z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div>
          <h3 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
            {{ tituloPainel }}
          </h3>
          <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            Defina o conteúdo e marque se é o prompt principal da IA
          </p>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        aria-label="Fechar editor"
        :disabled="salvando"
        @click="fechar"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-5 p-4">
      <div class="shrink-0 space-y-2">
        <label
          for="prompt-selecionado-titulo"
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Título
        </label>
        <BaseInput
          id="prompt-selecionado-titulo"
          v-model="titulo"
          placeholder="Ex.: Atendimento padrão"
          :disabled="salvando"
        />
      </div>

      <div class="shrink-0 space-y-2">
        <label
          for="prompt-selecionado-tipo"
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Tipo
        </label>
        <BaseInput
          id="prompt-selecionado-tipo"
          v-model="tipo"
          placeholder="Ex.: ESTOQUE"
          list="prompt-selecionado-tipo-sugestoes"
          :disabled="salvando"
        />
        <datalist id="prompt-selecionado-tipo-sugestoes">
          <option
            v-for="opcao in PROMPT_TIPOS_OPCOES"
            :key="opcao.value"
            :value="opcao.value"
          />
        </datalist>
        <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Digite o tipo livremente. Padrão: {{ PROMPT_WORKSPACE_TIPO_DEFAULT }}.
        </p>
      </div>

      <div class="flex min-h-0 flex-1 flex-col space-y-2">
        <div class="flex shrink-0 items-center justify-between gap-2">
          <label
            for="prompt-selecionado-conteudo"
            class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Conteúdo do prompt
          </label>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-outline/40 bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant dark:hover:border-primary-700 dark:hover:text-dark-primary"
            :disabled="salvando"
            title="Expandir editor"
            @click="abrirModalConteudo"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Expandir
          </button>
        </div>
        <textarea
          id="prompt-selecionado-conteudo"
          v-model="conteudo"
          :disabled="salvando"
          placeholder="Descreva como a IA deve se comportar, regras, tom de voz, contexto do negócio..."
          class="min-h-[14rem] w-full flex-1 resize-y overflow-y-auto rounded-xl border border-outline/40 bg-surface-container-high px-4 py-3 font-mono text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60 dark:focus:ring-primary-900/40 sm:min-h-[18rem] sm:max-h-[min(55vh,32rem)]"
          rows="14"
        />
        <p class="shrink-0 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ conteudo.length }} caracteres
        </p>
      </div>

      <label
        class="flex shrink-0 cursor-pointer items-start gap-3 rounded-xl border border-outline/40 bg-surface-container-high/50 p-4 transition-colors hover:border-primary-300 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/40 dark:hover:border-primary-700"
      >
        <input
          v-model="principal"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-outline text-primary-500 focus:ring-primary-500 dark:border-dark-outline"
          :disabled="salvando"
        />
        <span class="space-y-1">
          <span class="block text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            Definir como prompt principal
          </span>
          <span class="block text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            Apenas um prompt pode ser principal. Ele será usado como instrução base da IA neste workspace.
          </span>
        </span>
      </label>
    </div>

    <footer class="flex shrink-0 flex-col gap-3 border-t border-outline/40 p-4 dark:border-dark-outline/40 sm:flex-row sm:items-center sm:justify-end">
      <button
        v-if="!promptEmEdicao.isNovo"
        type="button"
        class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-container/30 disabled:opacity-50 sm:mr-auto sm:w-auto dark:border-danger/40 dark:text-dark-danger"
        :disabled="salvando"
        @click="excluir"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Excluir
      </button>
      <BaseButton
        id="btn-prompt-selecionado-cancelar"
        variant="secondary"
        size="sm"
        :block="false"
        :disabled="salvando"
        @click="fechar"
      >
        Cancelar
      </BaseButton>
      <BaseButton
        id="btn-prompt-selecionado-salvar"
        variant="primary"
        size="sm"
        :block="false"
        :disabled="salvando"
        @click="salvar"
      >
        {{ salvando ? 'Salvando...' : 'Salvar prompt' }}
      </BaseButton>
    </footer>

    <ModalEditor_prompt
      v-model:open="modalConteudoAberto"
      v-model:conteudo="conteudo"
      :disabled="salvando"
    />
  </section>
</template>
