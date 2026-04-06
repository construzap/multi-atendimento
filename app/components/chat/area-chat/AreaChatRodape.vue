<script setup lang="ts">
import { ref } from 'vue'
import BaseTextarea from '~/components/BaseTextarea.vue'

const mensagem = ref('')

function enviarMensagem() {
  const t = mensagem.value.trim()
  if (!t) return
  // Integração com API / store do chat em seguida
  mensagem.value = ''
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
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg transition-all hover:scale-105 active:scale-95"
        aria-label="Enviar mensagem"
        @click="enviarMensagem"
      >
        <span class="material-symbols-outlined" aria-hidden="true">send</span>
      </button>
    </div>
  </footer>
</template>
