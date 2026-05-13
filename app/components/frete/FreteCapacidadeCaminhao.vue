<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { FreteConfigWorkspace } from '#shared/types/frete'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import { useFreteStore } from '~/stores/frete'

const route = useRoute()
const workspaces = useWorkspacesStore()
const freteStore = useFreteStore()

const capacidadeKg = ref('')
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

const carregandoCapacidade = computed(() => {
  const wid = workspaceId.value
  if (wid == null) return false
  return freteStore.capacidadeCarregando(wid)
})

/** ID da linha `frete_config_workspace` (só após carregar do Pinia / salvar). */
const idConfigExibicao = computed(() => {
  const wid = workspaceId.value
  if (wid == null) return null
  const id = freteStore.capacidadePorWorkspace[wid]?.id
  return id != null && Number.isFinite(id) ? id : null
})

function formatKgDisplay(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n)
}

function aplicarCapacidadeDoPinia(wid: number) {
  const c = freteStore.capacidadePorWorkspace[wid]
  if (!c) return
  if (c.capacidade_caminhao_kg != null && Number.isFinite(c.capacidade_caminhao_kg)) {
    capacidadeKg.value = formatKgDisplay(c.capacidade_caminhao_kg)
  } else {
    capacidadeKg.value = ''
  }
}

watch(
  workspaceId,
  async (wid) => {
    freteStore.limparErroCapacidade()
    if (wid == null) {
      capacidadeKg.value = ''
      return
    }
    if (freteStore.capacidadePorWorkspace[wid] !== undefined) {
      aplicarCapacidadeDoPinia(wid)
      return
    }
    const ok = await freteStore.fetchCapacidadeSeNecessario(wid)
    if (ok) {
      aplicarCapacidadeDoPinia(wid)
    } else {
      capacidadeKg.value = ''
      if (freteStore.capacidadeFetchError) {
        toast.error(freteStore.capacidadeFetchError)
      }
    }
  },
  { immediate: true },
)

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.statusMessage === 'string' && o.statusMessage.trim()) return o.statusMessage
    const d = o.data as Record<string, unknown> | undefined
    if (d && typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
    if (d && typeof d.message === 'string' && d.message.trim()) return d.message
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Não foi possível salvar a capacidade.'
}

async function aoSalvar() {
  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Workspace não identificado.')
    return
  }

  saving.value = true
  try {
    const res = await $fetch<FreteConfigWorkspace>('/api/frete/config', {
      method: 'POST',
      body: {
        workspace_id: wid,
        capacidade_caminhao_kg: capacidadeKg.value,
      },
    })
    freteStore.aplicarCapacidadeSalva(wid, {
      id: res.id,
      capacidade_caminhao_kg: res.capacidade_caminhao_kg,
    })
    capacidadeKg.value = formatKgDisplay(res.capacidade_caminhao_kg)
    toast.success('Capacidade salva.')
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
      class="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg dark:bg-dark-surface-container-low"
    >
      <div class="px-6 py-6">
        <div class="flex items-start gap-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/80 dark:bg-dark-primary-container/90"
          >
            <span
              class="material-symbols-outlined text-[24px] text-primary-700 dark:text-white"
              aria-hidden="true"
            >local_shipping</span>
          </div>
          <div class="min-w-0 space-y-2">
            <p class="font-headline text-lg font-bold leading-snug text-on-surface dark:text-dark-on-surface md:text-xl">
              Capacidade do caminhão
            </p>
            <p class="font-body text-sm leading-relaxed text-on-surface dark:text-dark-on-surface md:text-base">
              Informe a capacidade máxima em <strong class="font-semibold text-on-surface dark:text-dark-on-surface">quilogramas (kg)</strong> para esta empresa.
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-5 bg-surface-container-low/50 px-6 py-6 dark:bg-dark-surface-container/40">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div class="min-w-0 flex-1 space-y-2">
            <label
              for="frete-capacidade-kg"
              class="block font-body text-sm font-semibold leading-snug text-on-surface dark:text-dark-on-surface"
            >
              Capacidade (kg)
            </label>
            <BaseInput
              id="frete-capacidade-kg"
              v-model="capacidadeKg"
              type="text"
              inputmode="decimal"
              name="capacidade-kg"
              placeholder="Ex.: 1.200"
              autocomplete="off"
              :disabled="saving || carregandoCapacidade"
              :input-class="inputFreteClass"
            />
          </div>

          <BaseButton
            type="button"
            variant="primary"
            :block="false"
            :disabled="saving || carregandoCapacidade || workspaceId == null"
            class="inline-flex shrink-0 items-center gap-2 !text-white dark:!bg-primary-600 dark:!text-white dark:hover:!bg-primary-700 sm:ml-2"
            @click="aoSalvar"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">save</span>
            {{ saving ? 'Salvando…' : 'Salvar' }}
          </BaseButton>
        </div>
      </div>

      <p
        v-if="idConfigExibicao != null"
        class="pointer-events-none absolute bottom-2 right-3 max-w-[min(100%,12rem)] truncate font-mono text-[10px] leading-tight text-on-surface-variant/55 dark:text-dark-on-surface-variant/50"
        title="ID interno da configuração (frete_config_workspace)"
      >
        ID {{ idConfigExibicao }}
      </p>
    </div>
  </div>
</template>
