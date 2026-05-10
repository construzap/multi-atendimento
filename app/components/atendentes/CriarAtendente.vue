<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useAtendentesStore } from '~/stores/atendentes'

const props = defineProps<{
  open: boolean
  workspaceId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const email = ref('')
const submitting = ref(false)
const atendentesStore = useAtendentesStore()

function close() {
  isOpen.value = false
}

async function onSubmit() {
  const e = email.value.trim()
  if (!e) {
    toast.warning('Informe o e-mail do atendente.')
    return
  }

  if (!Number.isFinite(props.workspaceId) || props.workspaceId < 1) {
    toast.error('Workspace inválido.')
    return
  }

  submitting.value = true
  try {
    await $fetch<{ ok: true }>('/api/atendentes', {
      method: 'POST',
      body: {
        workspace_id: props.workspaceId,
        email: e,
      },
    })
    toast.success('Atendente adicionado com sucesso.')
    await atendentesStore.fetchList(props.workspaceId)
    close()
    email.value = ''
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível adicionar o atendente.'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal v-model:open="isOpen" title="Adicionar atendente">
    <template #icon>
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" />
      </svg>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Workspace <span class="font-mono font-semibold text-on-surface dark:text-dark-on-surface">#{{ workspaceId }}</span>
      </p>

      <div>
        <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="atend-email">
          E-mail
        </label>
        <BaseInput
          id="atend-email"
          v-model="email"
          type="email"
          name="email"
          placeholder="nome@empresa.com"
          autocomplete="email"
          :disabled="submitting"
        />
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" :disabled="submitting" @click="close">
          Cancelar
        </BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton type="button" :disabled="!email.trim() || submitting" @click="onSubmit">
          {{ submitting ? 'Salvando…' : 'Adicionar' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
