<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import type { ItemSelecaoUnica } from '~/components/produtos/selecao-unica/produtosSelecaoUnicaConfig'
import type { ProdutoOportunidadeVendaItem, ProdutoWorkspacePatch } from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { useProdutosStore } from '~/stores/produtos'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const props = defineProps<{
  workspaceId: number | null
}>()

const emit = defineEmits<{
  /** Emitido ao fechar o modal se houve cadastro(s) — pai refresca lista/total e workspace. */
  sincronizar: []
}>()

const config = useRuntimeConfig()
const produtosStore = useProdutosStore()
const termosStore = useProdutoTermosPesquisaStore()
const {
  oportunidadesVendas,
  oportunidadesVendasTotal,
  oportunidadesVendasTotalPending,
  oportunidadesVendasListPending,
  oportunidadesVendasTemMais,
} = storeToRefs(produtosStore)

const modalAberto = ref(false)
/** True se cadastrou pelo menos um produto nesta abertura do modal. */
const cadastrouNestaAbertura = ref(false)
const itemEmCadastroChave = ref<string | null>(null)
const precoVistaDraft = ref('')
/** Termo de pesquisa (`ProdutosSelecaoUnica` / catalogo termos) — id → `termo_pesquisa`. */
const termoSelecao = ref<ItemSelecaoUnica | null>(null)
const cadastrando = ref(false)
const limiteAtingidoAberto = ref(false)
const limiteAtingidoMensagem = ref('')

const itemParaExcluir = ref<ProdutoOportunidadeVendaItem | null>(null)
const alertaExcluirAberto = ref(false)
const progressoExcluirAberto = ref(false)
const progressoExcluirTotal = ref(0)
const progressoExcluirEnviados = ref(0)
const progressoExcluirErro = ref<string | null>(null)
const excluindo = ref(false)

const whatsappComercialNumero = computed(() => {
  const raw = String(config.public.whatsappComercialNumero ?? '').replace(/\D/g, '')
  return raw.length ? raw : null
})

const whatsappLimiteUrl = computed(() => {
  const n = whatsappComercialNumero.value
  if (!n) return null
  const texto = encodeURIComponent(
    'Olá! Preciso aumentar o limite de produtos do meu workspace no multi-atendimento.',
  )
  return `https://wa.me/${n}?text=${texto}`
})

const mostrarBanner = computed(
  () =>
    props.workspaceId != null &&
    props.workspaceId >= 1 &&
    (oportunidadesVendasTotalPending.value ||
      oportunidadesVendasTotal.value > 0 ||
      modalAberto.value ||
      alertaExcluirAberto.value ||
      progressoExcluirAberto.value),
)

const textoBanner = computed(() => {
  const n = oportunidadesVendasTotal.value
  const label = n === 1 ? 'produto procurado' : 'produtos procurados'
  return `Existem ${n} ${label} por clientes que não estão no seu catálogo.`
})

function chaveItem(item: ProdutoOportunidadeVendaItem) {
  return `${item.workspace_id}:${item.canal_id ?? 'x'}:${item.produto_chave}`
}

function isEmCadastro(item: ProdutoOportunidadeVendaItem) {
  return itemEmCadastroChave.value === chaveItem(item)
}

watch(
  () => props.workspaceId,
  (wid) => {
    if (wid == null || wid < 1) {
      produtosStore.resetOportunidadesVendas()
      modalAberto.value = false
      cancelarCadastroInline()
      return
    }
    void produtosStore.fetchOportunidadesVendasTotal(wid)
  },
  { immediate: true },
)

watch(modalAberto, (aberto) => {
  if (aberto) return
  cancelarCadastroInline()
  limiteAtingidoAberto.value = false
  if (cadastrouNestaAbertura.value) {
    cadastrouNestaAbertura.value = false
    emit('sincronizar')
  }
})

function cancelarCadastroInline() {
  itemEmCadastroChave.value = null
  precoVistaDraft.value = ''
  termoSelecao.value = null
  cadastrando.value = false
}

/** Mesmo contrato da tabela (`@commit` com `termos_pesquisa_ids`). */
function aoCommitTermo(patch: ProdutoWorkspacePatch) {
  const ids = patch.termos_pesquisa_ids ?? []
  const id = ids[0]
  if (id == null || !Number.isFinite(id) || id < 1) {
    termoSelecao.value = null
    return
  }
  const tid = Math.trunc(id)
  const wid = props.workspaceId
  const nome =
    (wid != null && wid >= 1
      ? termosStore.getListaCompletaCopia(wid).find((t) => t.id === tid)?.nome
      : null) ??
    (termoSelecao.value?.id === tid ? termoSelecao.value.nome : null) ??
    ''
  termoSelecao.value = nome ? { id: tid, nome } : { id: tid, nome: String(tid) }
}

async function abrirSugestoes() {
  modalAberto.value = true
  cadastrouNestaAbertura.value = false
  cancelarCadastroInline()
  try {
    await produtosStore.fetchOportunidadesVendasPagina({ reset: true })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar as sugestões.'))
  }
}

async function carregarMais() {
  if (!oportunidadesVendasTemMais.value || oportunidadesVendasListPending.value) return
  try {
    await produtosStore.fetchOportunidadesVendasPagina({ reset: false })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar mais sugestões.'))
  }
}

function iniciarCadastro(item: ProdutoOportunidadeVendaItem) {
  itemEmCadastroChave.value = chaveItem(item)
  precoVistaDraft.value = ''
  termoSelecao.value = null
  limiteAtingidoAberto.value = false
}

function isErroLimiteProdutos(err: unknown): boolean {
  const msg = mensagemErroFetch(err, '').toLowerCase()
  if (msg.includes('limite de produtos') || msg.includes('só é possível adicionar mais')) return true
  const e = err as { statusCode?: number; data?: { statusCode?: number; statusMessage?: string } }
  const code = e?.statusCode ?? e?.data?.statusCode
  const statusMsg = String(e?.data?.statusMessage ?? '').toLowerCase()
  return code === 403 && (statusMsg.includes('limite') || msg.includes('limite'))
}

function idsOcorrencias(item: ProdutoOportunidadeVendaItem): number[] {
  return [
    ...new Set(
      (item.ocorrencias ?? [])
        .map((o) => o.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    ),
  ]
}

const textoAlertaExcluir = computed(() => {
  const item = itemParaExcluir.value
  if (!item) return ''
  const n = idsOcorrencias(item).length || item.ocorrencias?.length || item.total_buscas || 1
  const nome = item.produto_sugerido?.trim() || 'esta sugestão'
  return `Apagar «${nome}» e as ${n} ocorrência${n === 1 ? '' : 's'} associada${n === 1 ? '' : 's'}? Esta ação não pode ser desfeita.`
})

function pedirExcluir(item: ProdutoOportunidadeVendaItem) {
  if (cadastrando.value || excluindo.value) return
  const n = idsOcorrencias(item).length
  if (n < 1) {
    toast.error('Esta sugestão não tem ocorrências para apagar.')
    return
  }
  itemParaExcluir.value = item
  alertaExcluirAberto.value = true
}

function cancelarAlertaExcluir() {
  if (excluindo.value) return
  alertaExcluirAberto.value = false
  itemParaExcluir.value = null
}

async function confirmarExcluir() {
  const item = itemParaExcluir.value
  const wid = props.workspaceId
  if (!item || wid == null || wid < 1 || excluindo.value) return

  const total = idsOcorrencias(item).length
  alertaExcluirAberto.value = false
  progressoExcluirErro.value = null
  progressoExcluirTotal.value = total
  progressoExcluirEnviados.value = 0
  progressoExcluirAberto.value = true
  excluindo.value = true

  if (isEmCadastro(item)) cancelarCadastroInline()

  try {
    await produtosStore.excluirOportunidadeVenda({
      workspaceId: wid,
      item,
      onProgress: (enviados, tot) => {
        progressoExcluirEnviados.value = enviados
        progressoExcluirTotal.value = tot
      },
    })
    progressoExcluirEnviados.value = total
    toast.success(
      total === 1
        ? 'Ocorrência apagada.'
        : `${total} ocorrências apagadas.`,
    )
    itemParaExcluir.value = null
    sincronizarModalComListaSugestoes()
    window.setTimeout(() => {
      progressoExcluirAberto.value = false
    }, 400)
  } catch (err) {
    progressoExcluirErro.value = mensagemErroFetch(err, 'Não foi possível apagar as ocorrências.')
  } finally {
    excluindo.value = false
  }
}

function fecharProgressoExcluir() {
  if (excluindo.value) return
  progressoExcluirAberto.value = false
  progressoExcluirErro.value = null
  itemParaExcluir.value = null
}

/** Se não restar sugestão no Pinia, fecha o modal; senão mantém aberto. */
function sincronizarModalComListaSugestoes() {
  if (oportunidadesVendas.value.length === 0) {
    modalAberto.value = false
  }
}

async function confirmarCadastro(item: ProdutoOportunidadeVendaItem) {
  const wid = props.workspaceId
  if (wid == null || wid < 1 || cadastrando.value) return

  const precoRaw = precoVistaDraft.value.trim()
  let preco = 0
  if (precoRaw.length) {
    const n = parseDecimalPtBr(precoRaw)
    if (n == null || n < 0) {
      toast.error('Informe um preço à vista válido.')
      return
    }
    preco = n
  }

  cadastrando.value = true
  limiteAtingidoAberto.value = false
  try {
    await produtosStore.cadastrarProdutoDeOportunidade({
      workspaceId: wid,
      item,
      preco,
      termoPesquisaId: termoSelecao.value?.id ?? null,
    })
    cadastrouNestaAbertura.value = true
    cancelarCadastroInline()
    toast.success(`Produto «${item.produto_sugerido}» cadastrado.`)
    sincronizarModalComListaSugestoes()
  } catch (err) {
    if (isErroLimiteProdutos(err)) {
      limiteAtingidoMensagem.value =
        mensagemErroFetch(err, 'Limite de produtos atingido. É necessário aumentar o limite.')
      limiteAtingidoAberto.value = true
    } else {
      toast.error(mensagemErroFetch(err, 'Não foi possível cadastrar o produto.'))
    }
  } finally {
    cadastrando.value = false
  }
}
</script>

<template>
  <div v-if="mostrarBanner" class="space-y-0">
    <div
      v-if="oportunidadesVendasTotalPending || oportunidadesVendasTotal > 0"
      class="oportunidade-vendas-pulse flex flex-col gap-3 rounded-2xl border border-emerald-300/70 bg-gradient-to-r from-emerald-50 to-emerald-100/80 px-4 py-3 shadow-sm dark:border-emerald-800/60 dark:from-emerald-950/50 dark:to-emerald-900/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div class="min-w-0 flex items-start gap-3">
        <span
          class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg dark:bg-emerald-400/15"
          aria-hidden="true"
        >
          🔥
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Oportunidade de Vendas
          </p>
          <p class="mt-0.5 text-sm leading-snug text-emerald-800/90 dark:text-emerald-200/90">
            <template v-if="oportunidadesVendasTotalPending && oportunidadesVendasTotal === 0">
              A carregar oportunidades…
            </template>
            <template v-else>
              {{ textoBanner }}
            </template>
          </p>
        </div>
      </div>

      <BaseButton
        type="button"
        variant="success"
        size="sm"
        :block="false"
        class="shrink-0"
        :disabled="oportunidadesVendasTotalPending || oportunidadesVendasTotal === 0"
        @click="abrirSugestoes"
      >
        <span class="inline-flex items-center gap-1.5">
          Ver Sugestões ({{ oportunidadesVendasTotal }})
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
        </span>
      </BaseButton>
    </div>

    <BaseModal
      v-model:open="modalAberto"
      title="Sugestões de produtos"
      panel-class="w-full max-w-xl"
      body-class="max-h-[min(28rem,60vh)] overflow-y-auto"
    >
      <template #subtitle>
        Produtos buscados por clientes e ainda não cadastrados no catálogo.
      </template>

      <template #icon>
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">trending_up</span>
      </template>

      <div
        v-if="limiteAtingidoAberto"
        class="mb-4 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/40"
      >
        <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Limite de produtos atingido
        </p>
        <p class="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
          {{ limiteAtingidoMensagem || 'É necessário aumentar o limite de produtos do workspace.' }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a
            v-if="whatsappLimiteUrl"
            :href="whatsappLimiteUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
            Falar no WhatsApp
          </a>
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            :block="false"
            @click="limiteAtingidoAberto = false"
          >
            Fechar
          </BaseButton>
        </div>
      </div>

      <div
        v-if="oportunidadesVendasListPending && !oportunidadesVendas.length"
        class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        A carregar sugestões…
      </div>

      <template v-else>
        <ul class="space-y-3">
          <li
            v-for="item in oportunidadesVendas"
            :key="chaveItem(item)"
            class="rounded-xl border border-outline/30 bg-surface-container-lowest p-3 dark:border-dark-outline/35 dark:bg-dark-surface-container-lowest"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 space-y-1.5">
                <p class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                  {{ item.produto_sugerido }}
                </p>
                <span
                  class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  Buscado {{ item.total_buscas }}x por {{ item.clientes_unicos }}
                  {{ item.clientes_unicos === 1 ? 'cliente' : 'clientes' }}
                </span>
              </div>

              <div
                v-if="!isEmCadastro(item)"
                class="flex shrink-0 flex-wrap items-center justify-end gap-2"
              >
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
                  :disabled="cadastrando || excluindo"
                  title="Apagar sugestão"
                  aria-label="Apagar sugestão"
                  @click="pedirExcluir(item)"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
                </button>
                <BaseButton
                  type="button"
                  variant="primary"
                  size="sm"
                  :block="false"
                  :disabled="cadastrando || excluindo"
                  @click="iniciarCadastro(item)"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    Cadastrar
                  </span>
                </BaseButton>
              </div>
            </div>

            <div
              v-if="isEmCadastro(item)"
              class="mt-3 space-y-3 border-t border-outline/20 pt-3 dark:border-dark-outline/25"
            >
              <div>
                <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                  Preço à vista
                </label>
                <input
                  v-model="precoVistaDraft"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="0,00"
                  class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
                  :disabled="cadastrando"
                  @keydown.enter.prevent="confirmarCadastro(item)"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                  Termo de pesquisa
                </label>
                <ProdutosSelecaoUnica
                  catalogo="termos_pesquisa"
                  variant="celula"
                  :workspace-id="workspaceId"
                  :termo-id="termoSelecao?.id ?? null"
                  :termo-nome="termoSelecao?.nome ?? null"
                  :disabled="cadastrando"
                  @commit="aoCommitTermo"
                />
              </div>
              <div class="flex flex-wrap gap-2">
                <BaseButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  :block="false"
                  :disabled="cadastrando"
                  @click="cancelarCadastroInline"
                >
                  Cancelar
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="primary"
                  size="sm"
                  :block="false"
                  :disabled="cadastrando"
                  @click="confirmarCadastro(item)"
                >
                  {{ cadastrando ? 'A cadastrar…' : 'Confirmar' }}
                </BaseButton>
              </div>
            </div>
          </li>
        </ul>

        <div v-if="oportunidadesVendasTemMais" class="mt-4 flex justify-center">
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            :block="false"
            :disabled="oportunidadesVendasListPending || cadastrando || excluindo"
            @click="carregarMais"
          >
            {{ oportunidadesVendasListPending ? 'A carregar…' : 'Carregar mais' }}
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <ModalAlerta
      v-model:open="alertaExcluirAberto"
      title="Apagar sugestão"
      :texto="textoAlertaExcluir"
      variante="perigo"
      texto-confirmar="Apagar"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindo"
      :cancelar-desabilitado="excluindo"
      @confirmar="void confirmarExcluir()"
      @cancelar="cancelarAlertaExcluir"
    />

    <ModalEnvioProdutos
      v-model:open="progressoExcluirAberto"
      title="A apagar ocorrências…"
      :total="progressoExcluirTotal"
      :enviados="progressoExcluirEnviados"
      :erro="progressoExcluirErro"
      :pode-cancelar="!excluindo && !!progressoExcluirErro"
      @cancelar="fecharProgressoExcluir"
    />
  </div>
</template>

<style scoped>
.oportunidade-vendas-pulse {
  animation: oportunidade-vendas-pulse 2.2s ease-in-out infinite;
}

@keyframes oportunidade-vendas-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 0 rgb(16 185 129 / 0.35),
      0 1px 2px 0 rgb(0 0 0 / 0.05);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 0 0 8px rgb(16 185 129 / 0),
      0 1px 2px 0 rgb(0 0 0 / 0.05);
    transform: scale(1.01);
  }
}

@media (prefers-reduced-motion: reduce) {
  .oportunidade-vendas-pulse {
    animation: none;
  }
}
</style>
