<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseModal from '~/components/BaseModal.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseButton from '~/components/BaseButton.vue'
import type { Contato } from '#shared/types/contato'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useContatosStore } from '~/stores/contatos'

const props = defineProps<{
  open: boolean
  workspaceId: number | null
  contato: Contato | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  salvo: [contato: Contato]
}>()

const contatosStore = useContatosStore()
const canaisStore = useCanaisStore()

const name = ref('')
const phone = ref('')
const photo = ref('')
const conversaAberta = ref(true)
const isGroup = ref(false)
const nameGroup = ref('')
const iaLigada = ref(false)
const idCanal = ref('')
const submitting = ref(false)

const canais = computed(() => canaisStore.items)

const podeSalvar = computed(
  () =>
    props.workspaceId != null &&
    props.workspaceId > 0 &&
    props.contato != null &&
    phone.value.trim().length > 0 &&
    idCanal.value.trim().length > 0 &&
    !submitting.value,
)

function resetForm() {
  submitting.value = false
  name.value = ''
  phone.value = ''
  photo.value = ''
  conversaAberta.value = true
  isGroup.value = false
  nameGroup.value = ''
  iaLigada.value = false
  idCanal.value = ''
}

function preencherFormulario() {
  submitting.value = false
  const c = props.contato
  if (!c) return
  name.value = c.name ?? ''
  phone.value = c.phone ?? ''
  photo.value = c.photo ?? ''
  conversaAberta.value = c.conversa_aberta !== false
  isGroup.value = c.is_group === true
  nameGroup.value = c.name_group ?? ''
  iaLigada.value = c.ia_ligada === true
  idCanal.value = c.id_canal != null ? String(c.id_canal) : ''
}

watch(
  () => [props.open, props.contato?.key] as const,
  ([aberto]) => {
    if (!aberto) return
    preencherFormulario()
    const wid = props.workspaceId
    if (wid != null) void canaisStore.fetchCanais(wid).catch(() => {})
  },
)

async function onSalvar() {
  if (!podeSalvar.value || submitting.value || !props.contato) return

  const wid = props.workspaceId
  if (wid == null) return

  const canalId = Number.parseInt(idCanal.value, 10)
  if (!Number.isFinite(canalId) || canalId < 1) {
    toast.error('Selecione um canal válido.')
    return
  }

  submitting.value = true
  try {
    const atualizado = await contatosStore.atualizarContato(wid, props.contato.key, {
      name: name.value.trim() || null,
      phone: phone.value.trim(),
      photo: photo.value.trim() || null,
      conversa_aberta: conversaAberta.value,
      is_group: isGroup.value,
      name_group: isGroup.value ? nameGroup.value.trim() || null : null,
      ia_ligada: iaLigada.value,
      id_canal: canalId,
    })

    toast.success('Contato atualizado.')
    emit('salvo', atualizado)
    emit('update:open', false)
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o contato.'), { duration: 8000 })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Editar contato"
    panel-class="w-full max-w-lg"
    @update:open="emit('update:open', $event)"
    @close="resetForm"
  >
    <form class="space-y-4" @submit.prevent="onSalvar">
      <div>
        <label class="mb-1.5 block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Nome
        </label>
        <BaseInput v-model="name" placeholder="Nome do contato" />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Telefone
        </label>
        <BaseInput v-model="phone" placeholder="5511999999999" inputmode="numeric" />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          URL da foto
        </label>
        <BaseInput v-model="photo" placeholder="https://..." />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Canal
        </label>
        <select
          v-model="idCanal"
          class="w-full rounded-xl border border-outline/40 bg-white px-4 py-3 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
        >
          <option value="" disabled>Selecione um canal</option>
          <option v-for="canal in canais" :key="canal.id" :value="String(canal.id)">
            {{ canal.nome || `Canal #${canal.id}` }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-outline/30 px-4 py-3 text-sm dark:border-dark-outline/30">
          <input v-model="conversaAberta" type="checkbox" class="h-4 w-4 rounded border-outline/50" />
          Conversa aberta
        </label>

        <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-outline/30 px-4 py-3 text-sm dark:border-dark-outline/30">
          <input v-model="iaLigada" type="checkbox" class="h-4 w-4 rounded border-outline/50" />
          I.A. ligada
        </label>

        <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-outline/30 px-4 py-3 text-sm dark:border-dark-outline/30">
          <input v-model="isGroup" type="checkbox" class="h-4 w-4 rounded border-outline/50" />
          É grupo
        </label>
      </div>

      <div v-if="isGroup">
        <label class="mb-1.5 block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Nome do grupo
        </label>
        <BaseInput v-model="nameGroup" placeholder="Nome do grupo" />
      </div>

      <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <BaseButton type="button" variant="secondary" :block="false" @click="emit('update:open', false)">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" :disabled="!podeSalvar" :block="false">
          {{ submitting ? 'Salvando…' : 'Salvar' }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
