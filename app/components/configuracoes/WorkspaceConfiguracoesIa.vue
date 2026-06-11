<script setup lang="ts">
import { computed } from 'vue'
import BaseInput from '~/components/BaseInput.vue'
import { useConfiguracoesStore } from '~/stores/configuracoes'

const route = useRoute()
const workspaces = useWorkspacesStore()
const configuracoes = useConfiguracoesStore()

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const carregando = computed(() => {
  const id = workspaceId.value
  return id != null && configuracoes.carregando(id)
})

const desabilitado = computed(() => carregando.value || configuracoes.salvando)

const faseDeTeste = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? configuracoes.doWorkspace(id)?.fase_teste ?? false : false
  },
  set: (v: boolean) => {
    const id = workspaceId.value
    if (id != null) configuracoes.atualizarCampo(id, 'fase_teste', v)
  },
})

const telefone = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? configuracoes.doWorkspace(id)?.numero_testes ?? '' : ''
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) configuracoes.atualizarCampo(id, 'numero_testes', v)
  },
})

const emProducao = computed(() => !faseDeTeste.value)
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-red-200/80 bg-surface-container-lowest shadow-sm transition-colors dark:border-red-500/20 dark:bg-dark-surface-container-low dark:shadow-[inset_3px_0_0_0_rgba(248,113,113,0.55)]"
  >
    <div class="border-b border-red-100/80 p-6 dark:border-red-500/15 dark:bg-dark-surface-container-high/40">
      <div class="flex flex-wrap items-start gap-4">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/25"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[24px]">warning</span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2.5">
            <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
              Inteligência Artificial
            </h3>
            <span
              class="inline-flex items-center rounded-md border border-red-200/90 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              Zona crítica
            </span>
          </div>
          <p class="mt-1.5 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
            Alterações aqui afetam diretamente quem a IA atende em produção. Revise com atenção antes de salvar.
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-5 p-6">
      <div
        v-if="!workspaceId"
        class="rounded-xl border border-outline/40 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        Workspace não encontrado no estado atual.
      </div>

      <template v-else>
        <div
          v-if="emProducao"
          class="flex gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 dark:border-red-500/25 dark:bg-red-950/35"
          role="alert"
        >
          <span
            class="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-red-600 dark:text-red-400"
            aria-hidden="true"
          >
            error
          </span>
          <div class="min-w-0 text-sm">
            <p class="font-semibold text-red-800 dark:text-red-300">
              IA em produção
            </p>
            <p class="mt-1 leading-relaxed text-red-700/90 dark:text-red-200/75">
              A fase de teste está desativada. A assistente pode responder a qualquer cliente nos canais conectados.
            </p>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline/30 bg-surface-container-low/60 p-4 dark:border-dark-outline/35 dark:bg-dark-surface-container-high/50"
          :class="{ 'pointer-events-none opacity-60': desabilitado }"
        >
          <div class="min-w-0 flex-1">
            <p
              id="ws-config-ia-fase-teste-label"
              class="text-sm font-semibold text-on-surface dark:text-dark-on-surface"
            >
              Fase de teste
            </p>
            <p class="mt-1 text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
              Quando ativa, a IA responde apenas ao número de teste informado abaixo.
            </p>
          </div>

          <button
            id="ws-config-ia-fase-teste"
            type="button"
            role="switch"
            :aria-checked="faseDeTeste"
            aria-labelledby="ws-config-ia-fase-teste-label"
            :disabled="desabilitado"
            class="group relative isolate inline-flex h-8 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-dark-surface-container-low"
            :class="
              faseDeTeste
                ? 'bg-primary-600 shadow-inner shadow-primary-900/20 dark:bg-primary-500 dark:shadow-primary-950/30'
                : 'bg-red-600 shadow-inner shadow-red-900/25 dark:bg-red-500 dark:shadow-red-950/40'
            "
            @click="faseDeTeste = !faseDeTeste"
          >
            <span class="sr-only">{{ faseDeTeste ? 'Desativar fase de teste' : 'Ativar fase de teste' }}</span>
            <span
              aria-hidden="true"
              class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:bg-zinc-100 dark:ring-white/15"
              :class="faseDeTeste ? 'left-[calc(100%-1.5rem)]' : 'left-1'"
            />
          </button>
        </div>

        <div
          v-if="faseDeTeste"
          class="rounded-xl border border-outline/30 bg-surface-container-low/40 p-4 dark:border-dark-outline/35 dark:bg-dark-surface-container-high/40"
          :class="{ 'pointer-events-none opacity-60': desabilitado }"
        >
          <label
            class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
            for="ws-config-ia-telefone"
          >
            Número de telefone para teste
          </label>
          <p class="mb-3 text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
            A IA responderá somente a este número enquanto a fase de teste estiver ativa.
          </p>
          <BaseInput
            id="ws-config-ia-telefone"
            v-model="telefone"
            type="tel"
            name="ia_telefone_teste"
            autocomplete="tel"
            inputmode="numeric"
            pattern="^[0-9]{12,13}$"
            :maxlength="13"
            placeholder="5571999293684"
            title="Formato: (55 + DDD + 9 + os 8 dígitos, sem espaços). Exemplo: 5571988570826"
            invalid-message="Formato inválido. Use: (55 + DDD + 9 + os 8 dígitos, sem espaços). Exemplo: 5571988570826"
            :disabled="desabilitado"
          >
            <template #leading>
              <svg class="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                />
              </svg>
            </template>
          </BaseInput>
        </div>
      </template>
    </div>
  </section>
</template>
