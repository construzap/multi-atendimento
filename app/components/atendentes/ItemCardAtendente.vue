<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import BaseAvatar from '~/components/BaseAvatar.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useAtendentesStore } from '~/stores/atendentes'

const props = defineProps<{
  nome: string
  email?: string | null
  avatarText: string
  avatarGradientClass: string
  avatarSrc?: string | null
  /** PK em `atendentes` (para rodapé e exclusão). */
  registroId: number
  workspaceId: number
  /** Dono do workspace e não é o próprio cartão. */
  podeExcluir: boolean
  createdAt?: string
  /** `true` = Admin, `false` = Atendente; omitido = não exibe chip de papel. */
  isAdmin?: boolean
}>()

const atendentesStore = useAtendentesStore()
const modalExcluir = ref(false)
const excluindo = ref(false)

function formatCreatedAtPtBr(input: string) {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
}

const createdAtLabel = computed(() =>
  props.createdAt ? formatCreatedAtPtBr(props.createdAt) : '',
)

const showFooter = computed(() => props.registroId > 0 || Boolean(props.createdAt?.trim()))

const textoConfirmarExclusao = computed(() => {
  const n = props.nome?.trim() || 'Este atendente'
  return `Remover ${n} da equipe deste workspace? Ele perderá acesso ao ambiente.`
})

function abrirExcluir() {
  modalExcluir.value = true
}

async function confirmarExcluir() {
  if (!props.registroId || props.workspaceId < 1) {
    modalExcluir.value = false
    return
  }
  excluindo.value = true
  try {
    await $fetch('/api/atendentes/deletar', {
      method: 'POST',
      body: {
        workspace_id: props.workspaceId,
        atendente_id: props.registroId,
      },
    })
    toast.success('Atendente removido.')
    modalExcluir.value = false
    await atendentesStore.fetchList(props.workspaceId)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível remover o atendente.'))
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <article
    class="group relative flex h-64 flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="mb-4 flex items-start justify-between gap-2">
      <BaseAvatar
        :src="avatarSrc"
        :text="avatarText"
        :size="56"
        variant="rounded"
        :fallback-class="avatarGradientClass"
      />
      <div class="flex shrink-0 items-start gap-2">
        <span
          v-if="isAdmin === true"
          class="rounded-lg bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary-container"
        >
          Admin
        </span>
        <span
          v-else-if="isAdmin === false"
          class="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
        >
          Atendente
        </span>
        <button
          v-if="podeExcluir"
          type="button"
          class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-danger-container/30 hover:text-danger dark:text-dark-on-surface-variant dark:hover:bg-danger-container/20"
          aria-label="Remover atendente"
          @click.stop="abrirExcluir"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
        </button>
      </div>
    </div>

    <h3 class="font-headline line-clamp-2 text-lg font-bold leading-snug text-on-surface dark:text-dark-on-surface">
      {{ nome || 'Sem nome' }}
    </h3>
    <p
      v-if="email"
      class="mt-1 line-clamp-2 break-all font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ email }}
    </p>
    <p
      v-else
      class="mt-1 line-clamp-2 font-body text-sm italic text-on-surface-variant/80 dark:text-dark-on-surface-variant/80"
    >
      E-mail não informado
    </p>

    <div v-if="showFooter" class="mt-auto pt-4">
      <div class="flex items-center justify-between border-t border-outline/20 pt-4 dark:border-dark-outline/20">
        <p v-if="registroId > 0" class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          <span class="font-semibold">ID:</span> {{ registroId }}
        </p>
        <p
          v-if="createdAt?.trim()"
          class="inline-flex items-center gap-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          :class="{ 'ml-auto': registroId <= 0 }"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ createdAtLabel }}
        </p>
      </div>
    </div>

    <ModalAlerta
      v-model:open="modalExcluir"
      title="Remover atendente"
      :texto="textoConfirmarExclusao"
      variante="perigo"
      texto-confirmar="Remover"
      :confirmar-desabilitado="excluindo"
      @confirmar="confirmarExcluir"
    />
  </article>
</template>
