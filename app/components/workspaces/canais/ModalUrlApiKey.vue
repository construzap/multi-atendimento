<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import type { Canal } from '#shared/types/canal'

const props = withDefaults(
  defineProps<{
    open: boolean
    workspaceId: number
    canalId: number | null
    /** Quando true (fluxo do toggle sem key), ao salvar com API key ativa a I.A. */
    ativarIaAoSalvar?: boolean
  }>(),
  {
    ativarIaAoSalvar: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Emitido após salvar com sucesso tendo API key (nova ou já existente). */
  'salvo-com-key': []
}>()

const canaisStore = useCanaisStore()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const canal = computed((): Canal | null => {
  if (props.canalId == null) return null
  return canaisStore.items.find((c) => c.id === props.canalId) ?? null
})

const URL_PADRAO = 'https://api.openai.com/v1'
const MODEL_NAME_PADRAO = 'gpt-4.1-mini'

const url = ref('')
const modelName = ref('')
const apiKey = ref('')
const saving = ref(false)

function preencherDoPinia() {
  const c = canal.value
  const urlSalva = c?.url?.trim() ?? ''
  const modelSalvo = c?.model_name?.trim() ?? ''
  // Só preenche o exemplo se o campo ainda estiver vazio no canal
  url.value = urlSalva || URL_PADRAO
  modelName.value = modelSalvo || MODEL_NAME_PADRAO
  apiKey.value = ''
}

watch(isOpen, (aberto) => {
  if (aberto) preencherDoPinia()
  else {
    url.value = ''
    modelName.value = ''
    apiKey.value = ''
  }
})

watch(
  () => props.canalId,
  () => {
    if (isOpen.value) preencherDoPinia()
  },
)

function close() {
  isOpen.value = false
}

async function onSalvar() {
  const id = props.canalId
  if (!id || !Number.isFinite(props.workspaceId)) {
    toast.error('Canal ou workspace inválido.')
    return
  }

  const key = apiKey.value.trim()
  const temKeyAposSalvar = Boolean(key) || Boolean(canal.value?.tem_api_key)

  if (props.ativarIaAoSalvar && !key && !canal.value?.tem_api_key) {
    toast.warning('Informe a API key para ativar a I.A.')
    return
  }

  if (!key && !canal.value?.tem_api_key) {
    toast.warning('Informe a API key.')
    return
  }

  saving.value = true
  try {
    const payload: Parameters<typeof canaisStore.updateCanal>[0] = {
      id_canal: id,
      workspace_id: props.workspaceId,
      url: url.value.trim() || null,
      model_name: modelName.value.trim() || null,
      ...(key ? { api_key: key } : {}),
    }

    if (props.ativarIaAoSalvar) {
      // Com key → liga; sem key → desliga
      payload.tem_inteligencia_artificial = temKeyAposSalvar
    }

    await canaisStore.updateCanal(payload)

    if (temKeyAposSalvar) {
      emit('salvo-com-key')
      toast.success(
        props.ativarIaAoSalvar
          ? 'I.A. ativada e configuração salva.'
          : 'Configuração de I.A. salva.',
      )
    } else {
      toast.success('Configuração salva. I.A. permanece desativada (sem API key).')
    }
    close()
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar a configuração.'), {
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
    title="Configuração da API (I.A.)"
    panel-class="w-full max-w-md"
  >
    <template #subtitle>
      URL, modelo e API key do canal
      <template v-if="canal?.id"> · #{{ canal.id }}</template>
    </template>

    <div class="space-y-4">
      <div>
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="canal-ia-url"
        >
          URL
        </label>
        <BaseInput
          id="canal-ia-url"
          v-model="url"
          type="url"
          name="canal_ia_url"
          placeholder="https://api.openai.com/v1"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="canal-ia-model"
        >
          Model name
        </label>
        <BaseInput
          id="canal-ia-model"
          v-model="modelName"
          type="text"
          name="canal_ia_model"
          placeholder="Ex: gpt-4.1-mini"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="canal-ia-api-key"
        >
          API key
        </label>
        <BaseInput
          id="canal-ia-api-key"
          v-model="apiKey"
          type="password"
          name="canal_ia_api_key"
          :placeholder="
            canal?.tem_api_key
              ? '•••••••• (deixe vazio para manter a atual)'
              : 'sk-...'
          "
          autocomplete="new-password"
        />
        <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          A chave é criptografada no servidor (pgp_sym_encrypt) e nunca volta para o navegador.
        </p>
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" :disabled="saving" @click="close">
          Cancelar
        </BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton type="button" :disabled="saving" @click="onSalvar">
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
