<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type {
  LojaLogin,
  LojaLoginBuscaResponse,
  LojaLoginCompletarResponse,
  LojaLoginCriarResponse,
} from '#shared/types/loja'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'
import LojaLoginFormulario from '~/components/loja/login/LojaLoginFormulario.vue'
import LojaLoginConfirmar from '~/components/loja/login/LojaLoginConfirmar.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
  sucesso: []
}>()

const loja = useLojaWorkspaceStore()
const { canal } = storeToRefs(loja)

type Passo = 'telefone' | 'confirmar' | 'completar'

const passo = ref<Passo>('telefone')
const pending = ref(false)
const erro = ref('')
const celularBusca = ref('')
const candidato = ref<LojaLogin | null>(null)

const faltaNome = computed(() => !candidato.value?.nome?.trim())
const faltaCpf = computed(() => !soDigitosCpf(candidato.value?.cpf ?? ''))
const precisaCompletar = computed(() => faltaNome.value || faltaCpf.value)

const titulo = computed(() => {
  if (passo.value === 'confirmar') return 'Confirmar número'
  if (passo.value === 'completar') return 'Completar cadastro'
  return 'Fazer login'
})

function fechar() {
  emit('update:open', false)
  emit('close')
}

function resetar() {
  passo.value = 'telefone'
  pending.value = false
  erro.value = ''
  celularBusca.value = ''
  candidato.value = null
}

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) resetar()
  },
)

function mensagemErro(err: unknown, fallback: string) {
  if (!err || typeof err !== 'object') return fallback
  const e = err as Record<string, unknown>
  const data = e.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
  }
  if (typeof e.statusMessage === 'string' && e.statusMessage.trim()) return e.statusMessage
  return fallback
}

function soDigitosCpf(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  return d.length === 11 ? d : ''
}

function concluir(dados: LojaLogin) {
  loja.setLogin(dados)
  emit('sucesso')
  fechar()
}

async function buscarPorCelular(dados: { celular: string }) {
  erro.value = ''
  const idCanal = canal.value?.id
  if (!idCanal) {
    erro.value = 'Abra o link da loja para entrar.'
    return
  }

  celularBusca.value = dados.celular
  pending.value = true
  try {
    const busca = await $fetch<LojaLoginBuscaResponse>('/api/public/loja/login', {
      query: { id_canal: idCanal, celular: dados.celular },
    })

    if (busca.encontrado && busca.data) {
      candidato.value = busca.data
      passo.value = 'confirmar'
      return
    }

    candidato.value = null
    passo.value = 'completar'
  } catch (err) {
    erro.value = mensagemErro(err, 'Não foi possível buscar o número. Tente de novo.')
  } finally {
    pending.value = false
  }
}

function confirmarNumero() {
  if (!candidato.value) return
  if (precisaCompletar.value) {
    erro.value = ''
    passo.value = 'completar'
    return
  }
  concluir(candidato.value)
}

async function completarCadastro(dados: { nome: string; cpf: string }) {
  erro.value = ''
  const idCanal = canal.value?.id
  if (!idCanal) {
    erro.value = 'Abra o link da loja para entrar.'
    return
  }

  pending.value = true
  try {
    if (candidato.value?.key) {
      const res = await $fetch<LojaLoginCompletarResponse>('/api/public/loja/login', {
        method: 'PATCH',
        body: {
          id_canal: idCanal,
          conversa_key: candidato.value.key,
          ...(faltaNome.value ? { nome: dados.nome } : {}),
          ...(faltaCpf.value ? { cpf: dados.cpf } : {}),
        },
      })
      concluir(res.data)
      return
    }

    const criado = await $fetch<LojaLoginCriarResponse>('/api/public/loja/login', {
      method: 'POST',
      body: {
        id_canal: idCanal,
        nome: dados.nome,
        celular: celularBusca.value,
        cpf: dados.cpf,
      },
    })
    concluir(criado.data)
  } catch (err) {
    erro.value = mensagemErro(err, 'Não foi possível concluir o cadastro.')
  } finally {
    pending.value = false
  }
}

function recusarNumero() {
  candidato.value = null
  passo.value = 'telefone'
  erro.value = 'Digite o celular novamente.'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label="Fazer login"
      @click.self="fechar"
    >
      <section
        class="flex w-full max-w-lg flex-col rounded-t-3xl bg-surface-container-lowest pt-2 dark:bg-dark-surface md:max-w-2xl"
      >
        <div class="mx-auto mb-1 h-1 w-10 rounded-full bg-outline/30 dark:bg-dark-outline/30" />

        <header class="flex items-center justify-between px-5 py-3">
          <h2 class="text-lg font-semibold text-on-surface dark:text-dark-on-surface">
            {{ titulo }}
          </h2>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center text-on-surface dark:text-dark-on-surface"
            aria-label="Fechar"
            @click="fechar"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <LojaLoginConfirmar
          v-if="passo === 'confirmar' && candidato"
          :candidato="candidato"
          :pending="pending"
          @confirmar="confirmarNumero"
          @recusar="recusarNumero"
        />
        <LojaLoginFormulario
          v-else-if="passo === 'completar'"
          :pedir-nome="!candidato || faltaNome"
          :pedir-cpf="!candidato || faltaCpf"
          :pending="pending"
          :erro="erro"
          texto-botao="Entrar"
          @enviar="completarCadastro"
          @cancelar="fechar"
        />
        <LojaLoginFormulario
          v-else
          pedir-celular
          :inicial="{ celular: celularBusca }"
          :pending="pending"
          :erro="erro"
          texto-botao="Continuar"
          @enviar="buscarPorCelular"
          @cancelar="fechar"
        />
      </section>
    </div>
  </Teleport>
</template>
