<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { FreteBairroWorkspace } from '#shared/types/frete'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import { useFreteStore } from '~/stores/frete'

const route = useRoute()
const workspaces = useWorkspacesStore()
const freteStore = useFreteStore()

const bairro = ref('')
const preco = ref('')
const freteGratis = ref(false)
const saving = ref(false)

const inputFreteClass =
  'py-4 text-base text-gray-900 placeholder:text-gray-500 dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant'

const workspaceId = computed(() => {
  const fromPinia = workspaces.currentWorkspaceId
  const raw = fromPinia ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
})

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

async function aoEnviar(e: Event) {
  e.preventDefault()
  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Workspace não identificado.')
    return
  }

  const bairroTrim = bairro.value.trim()
  if (!bairroTrim) {
    toast.error('Informe o bairro.')
    return
  }
  if (!freteGratis.value && !String(preco.value ?? '').trim()) {
    toast.error('Informe o valor do frete ou marque frete grátis.')
    return
  }

  saving.value = true
  try {
    await $fetch<FreteBairroWorkspace>('/api/frete/bairro', {
      method: 'POST',
      body: {
        workspace_id: wid,
        bairro: bairroTrim,
        valor_frete: freteGratis.value ? null : preco.value,
        frete_gratis: freteGratis.value,
      },
    })
    bairro.value = ''
    preco.value = ''
    freteGratis.value = false
    await freteStore.recarregarBairrosRecentes(wid)
    toast.success('Frete por bairro salvo.')
  } catch (err) {
    toast.error(mensagemErro(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4">
    <div
      class="overflow-hidden rounded-2xl bg-surface-container-lowest p-8 shadow-lg dark:bg-dark-surface-container-low"
    >
      <form class="space-y-8" @submit="aoEnviar">
        <div class="mx-auto grid max-w-xl grid-cols-1 gap-8">
          <div class="space-y-2">
            <label
              for="frete-bairro"
              class="block font-body text-sm font-semibold leading-snug text-on-surface dark:text-dark-on-surface"
            >
              Bairro
            </label>
            <BaseInput
              id="frete-bairro"
              v-model="bairro"
              type="text"
              name="frete-bairro"
              placeholder="Ex.: Barra da Tijuca"
              autocomplete="street-address"
              :disabled="saving"
              :input-class="inputFreteClass"
            />
          </div>

          <div class="space-y-4">
            <label
              for="frete-preco"
              class="block font-body text-sm font-semibold leading-snug text-on-surface dark:text-dark-on-surface"
            >
              Preço do frete (R$)
            </label>

            <div
              class="flex flex-col gap-4 rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container-low to-surface-container-lowest p-4 shadow-sm ring-1 ring-black/[0.03] dark:border-dark-outline/40 dark:from-dark-surface-container dark:to-dark-surface-container-low dark:ring-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
            >
              <div class="min-w-0 flex-1">
                <p class="font-body text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                  Frete grátis neste bairro
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="freteGratis"
                :disabled="saving"
                class="group relative isolate inline-flex h-8 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-dark-surface-container-lowest"
                :class="
                  freteGratis
                    ? 'bg-primary-600 shadow-inner shadow-primary-900/25 dark:bg-primary-500 dark:shadow-primary-950/40'
                    : 'bg-surface-variant dark:bg-dark-surface-container-highest'
                "
                @click="freteGratis = !freteGratis"
              >
                <span class="sr-only">Alternar frete grátis</span>
                <span
                  aria-hidden="true"
                  class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-white/10"
                  :class="freteGratis ? 'left-[calc(100%-1.5rem)]' : 'left-1'"
                />
              </button>
            </div>

            <BaseInput
              id="frete-preco"
              v-model="preco"
              type="text"
              inputmode="decimal"
              name="frete-preco"
              placeholder="0,00"
              autocomplete="off"
              :disabled="saving || freteGratis"
              :input-class="inputFreteClass"
            >
              <template #leading>
                <span
                  class="text-base font-semibold"
                  :class="freteGratis ? 'text-gray-400 dark:text-dark-on-surface-variant/50' : 'text-gray-700 dark:text-dark-on-surface'"
                >R$</span>
              </template>
            </BaseInput>
          </div>
        </div>

        <div class="mx-auto flex w-full max-w-xl justify-center pt-10">
          <BaseButton
            type="submit"
            variant="primary"
            :disabled="saving || workspaceId == null"
            class="!text-white dark:!bg-primary-600 dark:!text-white dark:hover:!bg-primary-700"
          >
            <span class="inline-flex items-center justify-center gap-3 text-base font-semibold text-white">
              <span>{{ saving ? 'Salvando…' : 'Salvar frete' }}</span>
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">save</span>
            </span>
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
