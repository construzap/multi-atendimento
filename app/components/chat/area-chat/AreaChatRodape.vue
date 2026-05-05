<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseTextarea from '~/components/BaseTextarea.vue'

const mensagem = ref('')

const conversasStore = useConversasStore()
const canaisStore = useCanaisStore()
const mensagensStore = useMensagensStore()
const { conversaAtual, items } = storeToRefs(conversasStore)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

const conversaSelecionada = computed(() => {
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null
  return list.find((c) => firstNonEmpty(c.lid, c.phone, c.key) === key) ?? null
})

const telefoneDestino = computed(() => {
  const c = conversaSelecionada.value
  return firstNonEmpty(c?.phone, c?.lid, conversaAtual.value)
})

function enviarMensagem() {
  const t = mensagem.value.trim()
  if (!t) return
  const idCanal = canaisStore.currentCanalId
  if (!idCanal) {
    toast.error('Selecione um canal antes de enviar.')
    return
  }
  const tel = telefoneDestino.value
  if (!tel) {
    toast.error('Selecione uma conversa antes de enviar.')
    return
  }

  const lidSessao = String(conversaAtual.value)

  const tempId = mensagensStore.addOptimisticTextMessage({
    id_canal: idCanal,
    lid: lidSessao,
    phone: conversaSelecionada.value?.phone ?? null,
    connected_phone: null,
    text: t,
    name: conversaSelecionada.value?.name ?? null,
    photo: conversaSelecionada.value?.photo ?? null,
  })

  mensagem.value = ''

  void $fetch('/api/mensagens', {
    method: 'POST',
    body: {
      id_canal: idCanal,
      telefone: tel,
      conteudo: t,
      temp_id: tempId,
      conversa_sessao: lidSessao,
    },
  }).catch(() => {
    mensagensStore.removeByTempId(idCanal, lidSessao, tempId)
    toast.error(
      'Não foi possível enviar a mensagem. Tente de novo em instantes. Se o erro continuar, fale com o suporte.',
      { duration: 8000 },
    )
  })
}
</script>

<template>
  <footer
    class="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest p-6 dark:bg-slate-900"
  >
    <div class="flex items-end gap-4">
      <button
        type="button"
        class="text-on-surface-variant transition-colors hover:text-primary dark:text-slate-400"
        aria-label="Anexar ou mais"
      >
        <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
      </button>

      <div class="relative min-w-0 flex-1">
        <BaseTextarea
          id="chat-mensagem-input"
          v-model="mensagem"
          name="mensagem"
          placeholder="Escreva sua mensagem..."
          title="Enter envia a mensagem · Shift+Enter quebra linha"
          autocomplete="off"
          wrapper-id="chat-mensagem-wrap"
          :min-height-px="48"
          :max-height-px="160"
          input-class="!rounded-2xl !border-0 bg-surface-container-low !py-3 !pl-6 !pr-28 text-sm leading-relaxed !shadow-none focus:!border-transparent focus:!ring-1 focus:!ring-primary dark:!bg-slate-800 dark:!text-slate-200"
          @submit="enviarMensagem"
        >
          <template #trailing>
            <div class="flex gap-3 text-on-surface-variant dark:text-slate-400">
              <button type="button" class="hover:text-primary" aria-label="Emoji">
                <span class="material-symbols-outlined text-xl" aria-hidden="true">mood</span>
              </button>
              <button type="button" class="hover:text-primary" aria-label="Anexar arquivo">
                <span class="material-symbols-outlined text-xl" aria-hidden="true">attach_file</span>
              </button>
            </div>
          </template>
        </BaseTextarea>
      </div>

      <button
        type="button"
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Enviar mensagem"
        @click="enviarMensagem"
      >
        <span class="material-symbols-outlined" aria-hidden="true">send</span>
      </button>
    </div>
  </footer>
</template>
