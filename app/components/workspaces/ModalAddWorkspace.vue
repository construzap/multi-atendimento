<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const nome = ref('')
const descricao = ref('')

function close() {
  isOpen.value = false
}

async function onCreate() {
  const n = nome.value.trim()
  const d = descricao.value.trim()

  if (!n) {
    toast.warning('Informe o nome do workspace.')
    return
  }

  try {
    const store = useWorkspacesStore()
    await store.create({
      nome: n,
      descricao: d ? d : null
    })
    toast.success('Workspace criado com sucesso.')
    close()
    nome.value = ''
    descricao.value = ''
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao criar workspace.')
  }
}
</script>

<template>
  <BaseModal v-model:open="isOpen" title="Criar workspace">
    <template #icon>
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke-linecap="round" />
      </svg>
    </template>

    <div class="space-y-4">
      <div>
        <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-nome">
          Nome
        </label>
        <BaseInput id="ws-nome" v-model="nome" type="text" name="name" placeholder="Ex: Suporte Avançado" autocomplete="off" />
      </div>

      <div>
        <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-descricao">
          Descrição
        </label>
        <textarea
          id="ws-descricao"
          v-model="descricao"
          name="description"
          rows="4"
          placeholder="Descreva o objetivo deste workspace..."
          class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
        />
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" @click="close">Cancelar</BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton type="button" :disabled="!nome.trim()" @click="onCreate">Criar</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

