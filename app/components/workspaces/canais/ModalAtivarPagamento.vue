<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import type {
  CanalPagamentoInfo,
  CanalProvedorPagamentos,
  CanalTaxasCartao,
} from '#shared/types/canal'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

const props = defineProps<{
  open: boolean
  canalId?: number | null
  /** Fallback se o Pinia de workspaces ainda não tiver currentWorkspaceId. */
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const canaisStore = useCanaisStore()
const { items: canaisItems } = storeToRefs(canaisStore)
const workspacesStore = useWorkspacesStore()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const workspaceIdEfetivo = computed((): number | null => {
  const fromProp = props.workspaceId
  if (fromProp != null && Number.isFinite(fromProp) && fromProp > 0) return fromProp
  const raw = workspacesStore.currentWorkspaceId
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const loading = ref(false)
const provedor = ref<CanalProvedorPagamentos | null>(null)
const chavePix = ref('')
const credenciaisPagarme = ref('')
const temCredenciaisPagarme = ref(false)

type TaxaLinha = { id: string; parcela: string; valor: string }
const taxasLinhas = ref<TaxaLinha[]>([])

const PROVEDORES: { value: CanalProvedorPagamentos; label: string }[] = [
  { value: 'pagar.me', label: 'Pagar.me' },
  { value: 'asaas', label: 'Asaas' },
]

const provedorLabel = computed(() => {
  if (!provedor.value) return 'Selecione o provedor'
  return PROVEDORES.find((p) => p.value === provedor.value)?.label ?? provedor.value
})

/** Chave PIX só para Pagar.me — Asaas não exibe o campo. */
const mostraChavePix = computed(() => provedor.value === 'pagar.me')

function ordenarChavesParcela(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = Number.parseInt(a, 10)
    const nb = Number.parseInt(b, 10)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })
}

function formatTaxaValorExibicao(valor: number): string {
  const s = String(valor)
  return s.includes('.') ? s.replace('.', ',') : s
}

function taxasObjetoParaLinhas(obj: CanalTaxasCartao | null | undefined): TaxaLinha[] {
  const keys = ordenarChavesParcela(
    Object.keys(obj ?? {}).filter((k) => {
      const v = obj?.[k]
      return v != null && v !== 0
    }),
  )
  if (keys.length === 0) return []
  return keys.map((parcela) => ({
    id: `${parcela}-${Math.random().toString(36).slice(2, 8)}`,
    parcela,
    valor: formatTaxaValorExibicao(Number(obj?.[parcela] ?? 0)),
  }))
}

/**
 * Só parcelas com valor > 0; vírgula → ponto.
 * Sem taxas / só zeros → null (grava null no banco).
 */
function linhasParaTaxasObjeto(linhas: TaxaLinha[]): CanalTaxasCartao | null {
  const out: CanalTaxasCartao = {}
  for (const linha of linhas) {
    const rawKey = linha.parcela.trim().toLowerCase()
    const key = /^\d+$/.test(rawKey) ? `${rawKey}x` : rawKey
    if (!/^\d+x$/.test(key)) continue
    const valorStr = String(linha.valor).trim()
    if (!valorStr) continue
    const n = Number.parseFloat(valorStr.replace(',', '.'))
    if (!Number.isFinite(n) || n === 0) continue
    out[key] = n
  }
  return Object.keys(out).length > 0 ? out : null
}

function proximaParcelaDisponivel(): string {
  const usadas = new Set(
    taxasLinhas.value.map((l) => {
      const t = l.parcela.trim().toLowerCase()
      return /^\d+$/.test(t) ? `${t}x` : t
    }),
  )
  for (let i = 1; i <= 48; i++) {
    const k = `${i}x`
    if (!usadas.has(k)) return k
  }
  return `${taxasLinhas.value.length + 1}x`
}

function adicionarTaxa() {
  const parcela = proximaParcelaDisponivel()
  taxasLinhas.value = [
    ...taxasLinhas.value,
    {
      id: `${parcela}-${Date.now()}`,
      parcela,
      valor: '',
    },
  ]
}

function removerTaxa(id: string) {
  taxasLinhas.value = taxasLinhas.value.filter((l) => l.id !== id)
}

function aplicarPagamento(info: CanalPagamentoInfo) {
  provedor.value = info.provedor_pagamentos
  chavePix.value = info.chave_pix?.trim() ?? ''
  temCredenciaisPagarme.value = Boolean(info.tem_credenciais_pagarme)
  credenciaisPagarme.value = ''
  taxasLinhas.value = taxasObjetoParaLinhas(info.taxas_cartao ?? {})
}

function limparFormulario() {
  provedor.value = null
  chavePix.value = ''
  credenciaisPagarme.value = ''
  temCredenciaisPagarme.value = false
  taxasLinhas.value = taxasObjetoParaLinhas({})
}

function canalNoPinia(canalId: number) {
  return canaisItems.value.find((c) => Number(c.id) === Number(canalId))
}

function gravarPagamentoNoPinia(info: CanalPagamentoInfo) {
  const idx = canaisItems.value.findIndex((c) => Number(c.id) === Number(info.canal_id))
  if (idx === -1) return
  const atual = canaisItems.value[idx]
  if (!atual) return
  canaisStore.items[idx] = {
    ...atual,
    pagamento: { ...info },
  }
}

async function carregarDados() {
  const canalId = props.canalId
  const workspaceId = workspaceIdEfetivo.value
  if (canalId == null || workspaceId == null) {
    limparFormulario()
    return
  }

  const noPinia = canalNoPinia(canalId)
  if (noPinia?.pagamento && Number(noPinia.pagamento.workspace_id) === Number(workspaceId)) {
    aplicarPagamento({ ...noPinia.pagamento })
    return
  }

  loading.value = true
  try {
    const info = await $fetch<CanalPagamentoInfo>('/api/canais/pagamento', {
      query: {
        workspace_id: workspaceId,
        id: canalId,
      },
    })
    aplicarPagamento(info)
    gravarPagamentoNoPinia(info)
  } catch (err: unknown) {
    limparFormulario()
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar o pagamento.'), {
      duration: 8000,
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => [isOpen.value, props.canalId, workspaceIdEfetivo.value] as const,
  ([aberto]) => {
    if (aberto) void carregarDados()
    else limparFormulario()
  },
)

function selecionarProvedor(value: CanalProvedorPagamentos, close: () => void) {
  provedor.value = value
  close()
}

const saving = ref(false)

function close() {
  isOpen.value = false
}

function validarFormulario(): string | null {
  for (const linha of taxasLinhas.value) {
    const valorStr = String(linha.valor).trim()
    if (!valorStr) continue
    const rawKey = linha.parcela.trim().toLowerCase()
    const key = /^\d+$/.test(rawKey) ? `${rawKey}x` : rawKey
    if (!/^\d+x$/.test(key)) {
      return `Parcela inválida: "${linha.parcela}". Use o formato 1x, 2x, 12x…`
    }
  }
  return null
}

async function onSalvar() {
  const canalId = props.canalId
  const workspaceId = workspaceIdEfetivo.value
  if (canalId == null || workspaceId == null) {
    toast.error('Canal ou workspace inválido.')
    return
  }

  const erro = validarFormulario()
  if (erro) {
    toast.warning(erro)
    return
  }

  saving.value = true
  try {
    const info = await $fetch<CanalPagamentoInfo>('/api/canais/pagamento', {
      method: 'POST',
      body: {
        workspace_id: workspaceId,
        id: canalId,
        provedor_pagamentos: provedor.value,
        ...(provedor.value === 'pagar.me'
          ? { chave_pix: chavePix.value.trim() || null }
          : {}),
        taxas_cartao: linhasParaTaxasObjeto(taxasLinhas.value),
        ...(credenciaisPagarme.value.trim()
          ? { credenciais: credenciaisPagarme.value.trim() }
          : {}),
      },
    })
    aplicarPagamento(info)
    gravarPagamentoNoPinia(info)
    toast.success('Pagamento salvo.')
    close()
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o pagamento.'), {
      duration: 8000,
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="isOpen"
    title="Ativar pagamento"
    panel-class="w-full max-w-lg sm:max-h-[calc(100dvh-2rem)]"
    body-class="overscroll-contain"
  >
    <template #subtitle>
      Configuração de pagamento do canal
      <template v-if="canalId"> · #{{ canalId }}</template>
    </template>

    <div v-if="loading" class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando…
    </div>

    <div v-else class="space-y-5">
      <div>
        <p class="mb-2 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          Provedor de pagamentos
        </p>
        <BaseDropdown
          title="Provedor"
          align="left"
          block
          teleport
          panel-class="w-full min-w-[14rem]"
        >
          <template #trigger>
            <span
              class="flex w-full items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface dark:border-dark-outline/30 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
            >
              <span :class="provedor ? '' : 'text-on-surface-variant dark:text-dark-on-surface-variant'">
                {{ provedorLabel }}
              </span>
              <span class="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
                expand_more
              </span>
            </span>
          </template>
          <template #default="{ close: closeDropdown }">
            <div class="flex flex-col gap-1 p-1">
              <button
                v-for="opt in PROVEDORES"
                :key="opt.value"
                type="button"
                role="menuitem"
                class="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
                :class="
                  provedor === opt.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface dark:text-dark-on-surface'
                "
                @click="selecionarProvedor(opt.value, closeDropdown)"
              >
                {{ opt.label }}
              </button>
            </div>
          </template>
        </BaseDropdown>
      </div>

      <div v-if="mostraChavePix">
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="canal-pagamento-chave-pix"
        >
          Chave PIX
        </label>
        <BaseTextarea
          id="canal-pagamento-chave-pix"
          v-model="chavePix"
          name="chave_pix"
          :submit-on-enter="false"
          :min-height-px="72"
          :max-height-px="160"
          placeholder="CPF, e-mail, telefone ou chave aleatória"
        />
      </div>

      <div>
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="canal-pagamento-credenciais"
        >
          Credenciais
        </label>
        <BaseInput
          id="canal-pagamento-credenciais"
          v-model="credenciaisPagarme"
          type="password"
          name="credenciais_pagarme"
          autocomplete="new-password"
          :placeholder="
            temCredenciaisPagarme
              ? '•••••••• (deixe vazio para manter a atual)'
              : 'Secret key / credencial'
          "
        />
        <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          A credencial é criptografada no servidor e nunca volta para o navegador.
        </p>
      </div>

      <div>
        <p class="mb-2 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          Taxas do cartão (%)
        </p>

        <div class="space-y-2">
          <div
            v-for="linha in taxasLinhas"
            :key="linha.id"
            class="flex items-end gap-2"
          >
            <div class="w-20 shrink-0">
              <label
                class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                :for="`taxa-parcela-${linha.id}`"
              >
                Parcela
              </label>
              <BaseInput
                :id="`taxa-parcela-${linha.id}`"
                v-model="linha.parcela"
                type="text"
                :name="`taxa_parcela_${linha.id}`"
                placeholder="12x"
                autocomplete="off"
              />
            </div>
            <div class="min-w-0 flex-1">
              <label
                class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
                :for="`taxa-valor-${linha.id}`"
              >
                Taxa %
              </label>
              <BaseInput
                :id="`taxa-valor-${linha.id}`"
                v-model="linha.valor"
                type="text"
                inputmode="decimal"
                :name="`taxa_valor_${linha.id}`"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              class="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-error transition-colors hover:bg-error/10"
              :aria-label="`Remover taxa ${linha.parcela}`"
              title="Remover"
              @click="removerTaxa(linha.id)"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
            </button>
          </div>

          <div class="flex items-end justify-end gap-2">
            <button
              type="button"
              class="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-primary transition-colors hover:bg-primary/10"
              aria-label="Adicionar taxa"
              title="Adicionar"
              @click="adicionarTaxa"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" :disabled="loading || saving" @click="close">
          Cancelar
        </BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton type="button" :disabled="loading || saving" @click="onSalvar">
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
