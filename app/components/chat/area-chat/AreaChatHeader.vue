<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Conversa } from '#shared/types/conversa'
import { useMensagensStore } from '~/stores/mensagens'

const conversasStore = useConversasStore()
const canaisStore = useCanaisStore()
const mensagensStore = useMensagensStore()
const { conversaKeyAtiva } = useConversaKeyAtiva()

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

const conversaSelecionada = computed<Conversa | null>(() => {
  const key = conversaKeyAtiva.value
  if (!key) return null
  return conversasStore.findConversaByKey(key) ?? conversasStore.items.find((c) => c.key === key) ?? null
})

const avatarUrl = computed<string | undefined>(() => conversaSelecionada.value?.photo ?? undefined)
const nome = computed(() => {
  const c = conversaSelecionada.value
  if (!c) return conversaKeyAtiva.value ?? ''
  return firstNonEmpty(c.name, c.phone, c.lid, conversaKeyAtiva.value)
})
const telefone = computed(() => {
  const c = conversaSelecionada.value
  if (!c) return conversaKeyAtiva.value ?? ''
  if (c.is_group) return firstNonEmpty(c.phone, 'Grupo')
  return firstNonEmpty(c.phone, conversaKeyAtiva.value)
})

function fecharConversa() {
  const key = conversaKeyAtiva.value
  if (!key) return
  conversasStore
    .fecharConversa(key)
    .catch((err: unknown) => {
      toast.error(erroExclusaoFetch(err), { duration: 8000 })
    })
}

const modalExcluirAberto = ref(false)
const excluindo = ref(false)

const podeExcluir = computed(() => Boolean(mensagensStore.activeKey))

const modalCodigoOperadoraAberto = ref(false)
const codigoOperadoraRascunho = ref('')

const podeLigar = computed(() => {
  const c = conversaSelecionada.value
  if (!c || c.is_group) return false
  const phone = c.phone?.trim()
  return Boolean(phone && !phone.includes('@'))
})

/**
 * Monta o número do discador: código da operadora + DDD + número com o 9.
 * Tira o DDI 55. Se o 9 depois do DDD já existir, mantém; se faltar, insere.
 */
function montarNumeroDiscagem(phone: string, codigoOperadora: string): string | null {
  const codigo = codigoOperadora.replace(/\D/g, '')
  let digits = phone.replace(/\D/g, '')
  if (!codigo || !digits) return null

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2)
  }

  if (digits.length === 10) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`
  }

  return `${codigo}${digits}`
}

function abrirAplicativoLigacao(numero: string) {
  const a = document.createElement('a')
  a.href = `tel:${numero}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function discarComCodigo(codigo: string) {
  const phone = conversaSelecionada.value?.phone
  if (!phone) {
    toast.error('Esta conversa não tem telefone para ligar.')
    return
  }
  const numero = montarNumeroDiscagem(phone, codigo)
  if (!numero) {
    toast.error('Não foi possível montar o número para ligação.')
    return
  }
  abrirAplicativoLigacao(numero)
}

function ligar() {
  if (!podeLigar.value) {
    toast.error('Esta conversa não tem telefone para ligar.')
    return
  }

  conversasStore.hidratarCodigoOperadora()
  const codigo = conversasStore.codigoOperadora
  if (!codigo) {
    codigoOperadoraRascunho.value = ''
    modalCodigoOperadoraAberto.value = true
    return
  }

  discarComCodigo(codigo)
}

function onConfirmarCodigoOperadora() {
  const digits = codigoOperadoraRascunho.value.replace(/\D/g, '')
  if (digits.length < 2) {
    toast.error('Informe o código da operadora. Ex.: 021')
    return
  }
  conversasStore.setCodigoOperadora(digits)
  modalCodigoOperadoraAberto.value = false
  discarComCodigo(digits)
}

function erroExclusaoFetch(err: unknown): string {
  if (err && typeof err === 'object') {
    const data = (err as { data?: { statusMessage?: string } }).data
    if (typeof data?.statusMessage === 'string' && data.statusMessage.trim()) {
      return data.statusMessage.trim()
    }
    const msg = (err as { message?: string }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível excluir a conversa.'
}

function abrirModalExcluir() {
  modalExcluirAberto.value = true
}

async function onConfirmarExclusaoConversa() {
  const key = mensagensStore.activeKey
  if (!key) {
    modalExcluirAberto.value = false
    return
  }

  const canalId = canaisStore.currentCanalId
  const convAtual = conversasStore.conversaAtual

  excluindo.value = true
  try {
    await $fetch('/api/conversas/deletar', {
      method: 'POST',
      body: { key }
    })
    conversasStore.removeConversaByDbKey(key)
    if (canalId != null && convAtual != null && convAtual === key) {
      conversasStore.setConversaAtual(null)
    }
    mensagensStore.afterConversaDeleted(key)
    toast.success('Conversa excluída permanentemente.')
    modalExcluirAberto.value = false
  } catch (err: unknown) {
    toast.error(erroExclusaoFetch(err), { duration: 8000 })
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-outline/20 bg-surface-container-lowest px-6 dark:border-slate-700/80 dark:bg-slate-900"
  >
    <div class="flex min-w-0 items-center gap-3 pl-12 md:pl-0">
      <BaseAvatar :image-url="avatarUrl" :alt="nome" :size="40" variant="circle" />
      <div class="min-w-0">
        <h2 class="truncate font-headline text-base font-semibold text-zinc-950 dark:text-dark-on-surface">
          {{ nome }}
        </h2>
        <p class="text-[10px] text-zinc-600 dark:text-slate-400">
          {{ telefone }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-surface-container-high hover:text-primary disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary-300"
        aria-label="Ligar"
        :disabled="!podeLigar"
        @click="ligar"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">call</span>
      </button>
      <button
        type="button"
        class="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-surface-container-high hover:text-danger disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Excluir conversa"
        :disabled="!podeExcluir || excluindo"
        @click="abrirModalExcluir"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">delete</span>
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-slate-800"
        @click="fecharConversa"
      >
        Fechar conversa
      </button>
    </div>

    <ModalAlerta
      v-model:open="modalCodigoOperadoraAberto"
      title="Código da operadora"
      texto="Informe o código da operadora para completar a ligação. Ele fica salvo neste navegador e não vai para o banco."
      variante="info"
      texto-confirmar="Ligar"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="codigoOperadoraRascunho.replace(/\D/g, '').length < 2"
      @confirmar="onConfirmarCodigoOperadora"
    >
      <BaseInput
        id="codigo-operadora"
        v-model="codigoOperadoraRascunho"
        inputmode="numeric"
        autocomplete="off"
        placeholder="Ex.: 021"
        :maxlength="5"
        title="Código da operadora"
      />
    </ModalAlerta>

    <ModalAlerta
      v-model:open="modalExcluirAberto"
      title="Excluir conversa?"
      texto="A conversa e todas as mensagens serão apagadas permanentemente do banco. Esta ação não poderá ser desfeita."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindo"
      :cancelar-desabilitado="excluindo"
      @confirmar="onConfirmarExclusaoConversa"
    />
  </header>
</template>
