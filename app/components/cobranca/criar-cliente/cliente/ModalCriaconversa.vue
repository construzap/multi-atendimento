<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Conversa } from '#shared/types/conversa'
import BaseModal from '~/components/BaseModal.vue'

const props = defineProps<{
  open: boolean
  workspaceId: number
  idCanal: number
  /** Prefill do telefone (ex.: termo da busca). */
  phoneInicial?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [conversa: Conversa]
}>()

const name = ref('')
const phone = ref('')
const submitting = ref(false)
const erro = ref<string | null>(null)

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'

const podeSalvar = computed(() => {
  return (
    props.workspaceId > 0 &&
    props.idCanal > 0 &&
    name.value.trim().length > 0 &&
    phone.value.replace(/\D/g, '').length >= 10 &&
    !submitting.value
  )
})

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    submitting.value = false
    erro.value = null
    name.value = ''
    phone.value = (props.phoneInicial ?? '').trim()
  },
)

async function onCriar() {
  if (!podeSalvar.value) return
  submitting.value = true
  erro.value = null
  try {
    const conversa = await $fetch<Conversa>('/api/cobranca/criaconversa', {
      method: 'POST',
      body: {
        workspace_id: props.workspaceId,
        id_canal: props.idCanal,
        name: name.value.trim(),
        phone: phone.value.trim(),
      },
    })
    emit('created', conversa)
    emit('update:open', false)
  } catch (e: unknown) {
    const err = e as {
      statusMessage?: string
      data?: { statusMessage?: string; message?: string }
      message?: string
    }
    erro.value =
      err?.data?.statusMessage
      || err?.statusMessage
      || err?.data?.message
      || err?.message
      || 'Não foi possível criar a conversa.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="props.open"
    title="Criar nova conversa"
    panel-class="w-full max-w-md"
    @update:open="emit('update:open', $event)"
  >
    <template #subtitle>
      Informe o nome e o telefone para cadastrar neste canal.
    </template>

    <div class="space-y-4">
      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface" for="criaconversa-name">
          Nome
        </label>
        <input
          id="criaconversa-name"
          v-model="name"
          type="text"
          placeholder="Nome do cliente"
          autocomplete="off"
          :class="inputClass"
          :disabled="submitting"
          @keyup.enter="onCriar"
        >
      </div>

      <div class="space-y-1.5">
        <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface" for="criaconversa-phone">
          Telefone
        </label>
        <input
          id="criaconversa-phone"
          v-model="phone"
          type="tel"
          placeholder="Ex: 5511999999999"
          autocomplete="off"
          :class="inputClass"
          :disabled="submitting"
          @keyup.enter="onCriar"
        >
      </div>

      <p v-if="erro" class="font-body text-sm text-danger dark:text-dark-danger">
        {{ erro }}
      </p>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-outline/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low disabled:opacity-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
        :disabled="submitting"
        @click="emit('update:open', false)"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
        :disabled="!podeSalvar"
        @click="onCriar"
      >
        {{ submitting ? 'Criando…' : 'Criar conversa' }}
      </button>
    </template>
  </BaseModal>
</template>
