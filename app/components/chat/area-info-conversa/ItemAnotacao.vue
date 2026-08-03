<script setup lang="ts">
import { toast } from 'vue-sonner'
import ModalAlerta from '~/components/ModalAlerta.vue'
import type { AnotacaoTipo } from '#shared/types/anotacao'
import { useAnotacoesStore } from '~/stores/anotacoes'

const props = withDefaults(
  defineProps<{
    id: number
    workspaceId: number
    conversaKey: string
    autor?: string
    dataHora: string
    texto: string
    tipo?: AnotacaoTipo | null
    mediaUrl?: string | null
    anexos?: { nome: string; url?: string | null }[]
  }>(),
  {
    autor: 'Anotação',
    tipo: null,
    mediaUrl: null,
    anexos: () => [],
  },
)

const anotacoes = useAnotacoesStore()
const modalExcluirAberto = ref(false)
const excluindo = ref(false)

const temTexto = computed(() => Boolean(props.texto?.trim() && props.texto.trim() !== ' '))

const iconeTipo = computed(() => {
  switch (props.tipo) {
    case 'imagem':
      return 'image'
    case 'audio':
      return 'mic'
    case 'video':
      return 'videocam'
    case 'documento':
      return 'description'
    default:
      return 'sticky_note_2'
  }
})

function abrirModalExcluir() {
  if (excluindo.value) return
  modalExcluirAberto.value = true
}

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const msg = String((err as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
    if (msg.trim()) return msg
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível excluir a anotação.'
}

async function confirmarExcluir() {
  if (excluindo.value) return
  excluindo.value = true
  try {
    await anotacoes.excluir({
      workspaceId: props.workspaceId,
      conversaKey: props.conversaKey,
      anotacaoId: props.id,
    })
    modalExcluirAberto.value = false
    toast.success('Anotação excluída.')
  } catch (err) {
    toast.error(mensagemErro(err))
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <div
    class="rounded-xl border border-outline/30 p-4 dark:border-dark-outline/30"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
        <span class="material-symbols-outlined text-[12px]" aria-hidden="true">{{ iconeTipo }}</span>
        {{ props.autor }}
      </span>
      <div class="flex shrink-0 items-center gap-1">
        <span class="text-[9px] text-on-surface-variant dark:text-slate-400">
          {{ props.dataHora }}
        </span>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          :disabled="excluindo"
          aria-label="Excluir anotação"
          @click="abrirModalExcluir"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">delete</span>
        </button>
      </div>
    </div>

    <p
      v-if="temTexto"
      class="whitespace-pre-wrap break-words font-body text-xs text-on-surface dark:text-slate-300"
    >
      {{ props.texto }}
    </p>

    <div v-if="props.mediaUrl" class="mt-2">
      <img
        v-if="props.tipo === 'imagem'"
        :src="props.mediaUrl"
        alt="Anexo da anotação"
        class="max-h-40 w-full rounded-lg object-cover"
      />
      <audio
        v-else-if="props.tipo === 'audio'"
        :src="props.mediaUrl"
        class="w-full"
        controls
      />
      <video
        v-else-if="props.tipo === 'video'"
        :src="props.mediaUrl"
        class="max-h-40 w-full rounded-lg"
        controls
      />
      <a
        v-else
        :href="props.mediaUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[10px] text-primary hover:underline dark:bg-slate-700"
      >
        <span class="material-symbols-outlined text-[12px]" aria-hidden="true">description</span>
        Abrir anexo
      </a>
    </div>

    <div v-if="props.anexos?.length" class="mt-2 flex flex-wrap gap-2">
      <div
        v-for="a in props.anexos"
        :key="a.nome"
        class="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[9px] dark:bg-slate-700"
      >
        <span class="material-symbols-outlined text-[10px]" aria-hidden="true">description</span>
        <a
          v-if="a.url"
          :href="a.url"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
        >
          {{ a.nome }}
        </a>
        <span v-else>{{ a.nome }}</span>
      </div>
    </div>

    <ModalAlerta
      v-model:open="modalExcluirAberto"
      title="Excluir anotação?"
      texto="Esta ação remove a anotação permanentemente e não poderá ser desfeita."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindo"
      :cancelar-desabilitado="excluindo"
      :mostrar-fechar="!excluindo"
      @confirmar="confirmarExcluir"
    />
  </div>
</template>
