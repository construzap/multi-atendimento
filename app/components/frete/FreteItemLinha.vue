<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { FreteBairroAtualizarBody, FreteBairroWorkspace } from '#shared/types/frete'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import { useFreteStore } from '~/stores/frete'

const props = defineProps<{
  id: number
  workspaceId: number
  bairro: string
  valorFrete: number | null
  freteGratis: boolean
}>()

const freteStore = useFreteStore()

const editando = ref(false)
const draftBairro = ref('')
const draftGratis = ref(false)
const draftPreco = ref('')
const saving = ref(false)

const inputBairroClass =
  'py-3 text-base text-gray-900 placeholder:text-gray-500 dark:text-zinc-50 dark:placeholder:text-zinc-500'

const inputFreteClass =
  'py-3 text-sm text-gray-900 placeholder:text-gray-500 dark:text-zinc-50 dark:placeholder:text-zinc-500'

const legenda = computed(() => {
  const g = editando.value ? draftGratis.value : props.freteGratis
  return g ? 'Frete grátis' : 'Taxa por bairro'
})

const exibirColunaPreco = computed(() => !editando.value || draftGratis.value)

const destaqueGratis = computed(() => (editando.value ? draftGratis.value : props.freteGratis))

const precoFormatado = computed(() => {
  if (destaqueGratis.value) return 'Grátis'
  const n = props.valorFrete ?? 0
  const brl = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
  return brl.replace(/\u00A0/g, ' ')
})

function valorParaCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.statusMessage === 'string' && o.statusMessage.trim()) return o.statusMessage
    const d = o.data as Record<string, unknown> | undefined
    if (d && typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
    if (d && typeof d.message === 'string' && d.message.trim()) return d.message
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Não foi possível salvar o frete.'
}

function entrarEdicao() {
  draftBairro.value = props.bairro
  draftGratis.value = props.freteGratis
  draftPreco.value = valorParaCampo(props.valorFrete)
  editando.value = true
}

function cancelarEdicao() {
  editando.value = false
}

async function salvar() {
  const nomeBairro = draftBairro.value.trim()
  if (!nomeBairro) {
    toast.error('Informe o bairro.')
    return
  }
  if (!draftGratis.value && !String(draftPreco.value ?? '').trim()) {
    toast.error('Informe o valor do frete ou marque frete grátis.')
    return
  }

  saving.value = true
  try {
    const body: FreteBairroAtualizarBody = {
      id: props.id,
      workspace_id: props.workspaceId,
      bairro: nomeBairro,
      frete_gratis: draftGratis.value,
    }
    if (!draftGratis.value) {
      body.valor_frete = draftPreco.value
    }

    await $fetch<FreteBairroWorkspace>('/api/frete/bairro', {
      method: 'PATCH',
      body,
    })

    await freteStore.recarregarBairrosRecentes(props.workspaceId)
    editando.value = false
    toast.success('Frete atualizado.')
  } catch (err) {
    toast.error(mensagemErro(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-4 px-5 py-6 transition-colors hover:bg-surface-container-low dark:hover:bg-dark-surface-container sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8"
  >
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/80 dark:bg-dark-primary-container/90"
      >
        <span
          class="material-symbols-outlined text-[26px] text-primary-700 dark:text-white"
          aria-hidden="true"
        >location_on</span>
      </div>
      <div class="min-w-0 flex-1 space-y-2">
        <template v-if="!editando">
          <div class="truncate font-body text-base font-bold leading-snug text-zinc-900 dark:text-zinc-50">
            {{ bairro }}
          </div>
        </template>
        <template v-else>
          <label :for="`frete-edit-bairro-${id}`" class="sr-only">Bairro</label>
          <BaseInput
            :id="`frete-edit-bairro-${id}`"
            v-model="draftBairro"
            type="text"
            :name="`frete-edit-bairro-${id}`"
            placeholder="Nome do bairro"
            autocomplete="off"
            :disabled="saving"
            :input-class="inputBairroClass"
          />
        </template>
        <div
          class="font-body text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-zinc-400"
        >
          {{ legenda }}
        </div>
      </div>
    </div>

    <div
      class="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto sm:flex-nowrap sm:gap-5 sm:pl-4"
    >
      <!-- Indicador / edição: switch -->
      <div
        v-if="!editando"
        class="flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-sm transition-colors
          border-zinc-200/90 bg-zinc-50/90
          dark:border-white/12 dark:bg-zinc-950/90 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
        :title="freteGratis ? 'Entrega sem cobrança de frete' : 'Frete com valor fixo'"
      >
        <div
          class="relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200"
          :class="
            freteGratis
              ? 'bg-primary-600 dark:bg-primary-600'
              : 'bg-zinc-400 dark:bg-zinc-600'
          "
          role="img"
          :aria-label="freteGratis ? 'Frete grátis ativo' : 'Frete com taxa'"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-white
              shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.18),0_0_12px_rgba(255,255,255,0.55)]
              transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              dark:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.45),0_0_20px_rgba(255,255,255,0.42)]"
            :class="freteGratis ? 'left-[calc(100%-1.375rem-0.125rem)]' : 'left-0.5'"
          />
        </div>
        <span class="font-body text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {{ freteGratis ? 'Grátis' : 'Com taxa' }}
        </span>
      </div>

      <div
        v-else
        class="flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-sm
          border-zinc-200/90 bg-zinc-50/90
          dark:border-white/12 dark:bg-zinc-950/90 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        <button
          type="button"
          role="switch"
          :aria-checked="draftGratis"
          :disabled="saving"
          class="group relative isolate inline-flex h-8 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950"
          :class="
            draftGratis
              ? 'bg-primary-600 shadow-inner shadow-primary-900/25 dark:bg-primary-500 dark:shadow-primary-950/40'
              : 'bg-zinc-400 dark:bg-zinc-600'
          "
          @click="draftGratis = !draftGratis"
        >
          <span class="sr-only">Alternar frete grátis</span>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-white/10"
            :class="draftGratis ? 'left-[calc(100%-1.5rem)]' : 'left-1'"
          />
        </button>
        <span class="font-body text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {{ draftGratis ? 'Grátis' : 'Com taxa' }}
        </span>
      </div>

      <div v-if="exibirColunaPreco" class="min-w-[5.5rem] space-y-1 text-right">
        <div
          class="font-body text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50"
          :class="destaqueGratis ? 'text-primary-700 dark:text-primary-200' : ''"
        >
          {{ precoFormatado }}
        </div>
        <div class="font-body text-xs font-medium text-on-surface-variant dark:text-zinc-400">
          {{ destaqueGratis ? 'Sem cobrança' : 'Taxa fixa' }}
        </div>
      </div>

      <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[10rem] sm:items-end">
        <template v-if="!editando">
          <button
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center self-end rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface shadow-sm transition-colors hover:bg-surface-container-high hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/12 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-primary-200"
            aria-label="Editar frete deste bairro"
            @click="entrarEdicao"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">edit</span>
          </button>
        </template>
        <template v-else>
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
          >
            <BaseInput
              v-if="!draftGratis"
              :id="`frete-edit-preco-${id}`"
              v-model="draftPreco"
              type="text"
              inputmode="decimal"
              :name="`frete-edit-preco-${id}`"
              placeholder="0,00"
              autocomplete="off"
              :disabled="saving"
              :input-class="inputFreteClass"
              class="w-full min-w-0 sm:w-36"
            >
              <template #leading>
                <span
                  class="text-sm font-semibold text-gray-700 dark:text-zinc-200"
                >R$</span>
              </template>
            </BaseInput>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <BaseButton
                type="button"
                variant="primary"
                size="sm"
                :block="false"
                class="!min-h-10 !px-4 !text-sm !font-semibold !text-white dark:!bg-primary-600 dark:!text-white"
                :disabled="saving"
                @click="salvar"
              >
                {{ saving ? 'Salvando…' : 'Salvar' }}
              </BaseButton>
              <button
                type="button"
                class="rounded-lg px-3 py-2 font-body text-sm font-medium text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                :disabled="saving"
                @click="cancelarEdicao"
              >
                Cancelar
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
