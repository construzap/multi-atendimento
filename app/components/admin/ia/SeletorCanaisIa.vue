<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { mensagemErroFetch } from '~/stores/canais'

const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const adminStore = useAdminStore()
const adminIaStore = useAdminIaStore()
const { selectedWorkspaceId } = storeToRefs(adminStore)
const { canaisItens, canaisPending, canaisLoaded, canaisError, perfilIaAtual, iasAtreladas, limiteIas } =
  storeToRefs(adminIaStore)

const search = ref('')
const limiteIasDraft = ref(0)

watch(
  perfilIaAtual,
  (perfil) => {
    limiteIasDraft.value = perfil?.limite_ias ?? 0
  },
  { immediate: true },
)

const carregando = computed(() => canaisPending.value && !canaisLoaded.value)

const mostrarResumoPerfil = computed(
  () => Boolean(selectedWorkspaceId.value && perfilIaAtual.value && !carregando.value && !canaisError.value),
)

const percentualIaUso = computed(() => {
  const limite = limiteIas.value
  if (limite == null || limite <= 0) return 0
  return Math.min(100, Math.round((iasAtreladas.value / limite) * 100))
})

const limiteIaAtingido = computed(() => {
  const limite = limiteIas.value
  if (limite == null) return false
  return iasAtreladas.value >= limite
})

const iasDisponiveis = computed(() => {
  const limite = limiteIas.value
  if (limite == null) return null
  return Math.max(0, limite - iasAtreladas.value)
})

const limiteIasAlterado = computed(() => {
  if (limiteIas.value == null) return false
  return limiteIasDraft.value !== limiteIas.value
})

const filtrados = computed(() => {
  const termo = search.value.trim().toLowerCase()
  if (!termo) return canaisItens.value
  return canaisItens.value.filter((c) => {
    const nome = (c.nome ?? '').toLowerCase()
    const descricao = (c.descricao ?? '').toLowerCase()
    const provedor = rotuloProvedor(c.provedor).toLowerCase()
    return nome.includes(termo) || descricao.includes(termo) || provedor.includes(termo)
  })
})

function nomeCanal(canal: { id: number; nome: string | null }) {
  const n = canal.nome?.trim()
  return n || `Canal #${canal.id}`
}

function rotuloProvedor(provedor: number | null) {
  if (provedor === 1) return 'WhatsApp'
  if (provedor == null) return '—'
  return `Provedor ${provedor}`
}

function isWhatsapp(provedor: number | null) {
  return provedor === 1
}

async function alternarIa(canalId: number) {
  if (adminIaStore.canalIaSalvando(canalId)) return

  try {
    await adminIaStore.alternarIaCanal(canalId)
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar a I.A do canal.'))
  }
}

function canalSalvando(canalId: number) {
  return adminIaStore.canalIaSalvando(canalId)
}

async function salvarLimiteIas() {
  if (adminIaStore.limiteIasSalvando || !limiteIasAlterado.value) return

  try {
    await adminIaStore.atualizarLimiteIas(limiteIasDraft.value)
    toast.success('Limite de I.A atualizado.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o limite de I.A.'))
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="shrink-0 border-b border-outline/40 dark:border-dark-outline/40"
      :class="compact ? 'p-3' : 'px-4 py-4'"
    >
      <p
        v-if="!compact"
        class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Canais
      </p>
      <h3
        class="font-headline font-bold text-on-surface dark:text-dark-on-surface"
        :class="compact ? 'text-sm' : 'mt-0.5 text-base'"
      >
        I.A por canal
      </h3>
      <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha em quais canais a inteligência artificial ficará ativa
      </p>

      <div class="relative mt-3">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar canal..."
          class="h-8 w-full rounded-lg border border-outline/40 bg-surface-container-high py-0 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60"
        />
      </div>

      <div
        v-if="mostrarResumoPerfil && perfilIaAtual"
        class="mt-3 rounded-xl border border-outline/40 bg-surface-container-high/60 p-3 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/50"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Plano do perfil
            </p>
            <p class="mt-0.5 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              {{ iasAtreladas }} de {{ limiteIas ?? 0 }} I.A em uso
            </p>
            <p
              v-if="iasDisponiveis != null"
              class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              <template v-if="limiteIaAtingido">
                Limite atingido — faça upgrade ou desative em outro workspace
              </template>
              <template v-else>
                {{ iasDisponiveis }} vaga(s) disponível(is)
              </template>
            </p>
          </div>
          <span
            class="shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums"
            :class="
              limiteIaAtingido
                ? 'bg-danger-container/40 text-danger dark:text-dark-danger'
                : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
            "
          >
            {{ percentualIaUso }}%
          </span>
        </div>
        <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-outline/25 dark:bg-dark-outline/30">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="limiteIaAtingido ? 'bg-danger' : 'bg-violet-500'"
            :style="{ width: `${percentualIaUso}%` }"
          />
        </div>

        <div class="mt-3 flex items-end gap-2 border-t border-outline/20 pt-3 dark:border-dark-outline/20">
          <label class="min-w-0 flex-1">
            <span class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Limite de I.A
            </span>
            <input
              v-model.number="limiteIasDraft"
              type="number"
              min="0"
              step="1"
              :disabled="adminIaStore.limiteIasSalvando"
              class="h-8 w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:ring-primary-900/40"
            />
          </label>
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="adminIaStore.limiteIasSalvando || !limiteIasAlterado"
            @click="salvarLimiteIas"
          >
            {{ adminIaStore.limiteIasSalvando ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p
        v-if="!selectedWorkspaceId"
        class="px-3 py-10 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Selecione um workspace para listar os canais.
      </p>

      <div
        v-else-if="carregando"
        class="flex items-center justify-center gap-2 py-10 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando canais...
      </div>

      <p
        v-else-if="canaisError"
        class="px-3 py-10 text-center text-sm text-danger dark:text-dark-danger"
      >
        {{ canaisError }}
      </p>

      <p
        v-else-if="!filtrados.length"
        class="px-3 py-10 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum canal encontrado.
      </p>

      <ul v-else class="divide-y divide-outline/30 dark:divide-dark-outline/30">
        <li v-for="canal in filtrados" :key="canal.id">
          <div
            class="flex items-center gap-3 px-3 py-3 transition-colors"
            :class="canal.tem_inteligencia_artificial ? 'bg-violet-50/60 dark:bg-violet-950/20' : ''"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              :class="
                canal.tem_inteligencia_artificial
                  ? 'bg-violet-500 text-white'
                  : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
              "
              aria-hidden="true"
            >
              <svg
                v-if="isWhatsapp(canal.provedor)"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-on-surface dark:text-dark-on-surface">
                {{ nomeCanal(canal) }}
              </p>
              <p class="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ rotuloProvedor(canal.provedor) }}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              :aria-checked="canal.tem_inteligencia_artificial"
              :aria-label="`${canal.tem_inteligencia_artificial ? 'Desativar' : 'Ativar'} I.A em ${nomeCanal(canal)}`"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-dark-background"
              :class="canal.tem_inteligencia_artificial ? 'bg-violet-500' : 'bg-outline/50 dark:bg-dark-outline/50'"
              :disabled="canalSalvando(canal.id)"
              @click="alternarIa(canal.id)"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="canal.tem_inteligencia_artificial ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="shrink-0 border-t border-outline/40 bg-surface-container-high/40 px-3 py-2 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/30">
      <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ canaisItens.length }} canal(is) neste workspace
      </p>
    </div>
  </div>
</template>
