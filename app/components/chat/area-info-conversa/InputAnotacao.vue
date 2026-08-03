<script setup lang="ts">
import { toast } from 'vue-sonner'
import { storeToRefs } from 'pinia'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { useAnotacoesStore } from '~/stores/anotacoes'
import { useConversasStore } from '~/stores/conversas'
import { useWorkspacesStore } from '~/stores/workspaces'

const texto = ref('')
const arquivo = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const enviando = ref(false)

const inputImagem = ref<HTMLInputElement | null>(null)
const inputAudio = ref<HTMLInputElement | null>(null)
const inputVideo = ref<HTMLInputElement | null>(null)
const inputAnexo = ref<HTMLInputElement | null>(null)

const {
  isRecording,
  isPaused,
  recordSeconds,
  formatRecordTime,
  startRecording,
  togglePauseRecording,
  cancelRecording,
  stopAndGetAudio,
} = useAudioRecorder()

const conversas = useConversasStore()
const workspaces = useWorkspacesStore()
const anotacoes = useAnotacoesStore()
const { conversaAtual, activeCanalId } = storeToRefs(conversas)

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null ? Number.parseInt(String(raw), 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

const nomeArquivo = computed(() => arquivo.value?.name ?? '')

const tipoPreview = computed(() => {
  const mime = (arquivo.value?.type ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (arquivo.value) return 'documento'
  return null
})

const controlesBloqueados = computed(() => enviando.value)

function limparArquivo() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  arquivo.value = null
  if (inputImagem.value) inputImagem.value.value = ''
  if (inputAudio.value) inputAudio.value.value = ''
  if (inputVideo.value) inputVideo.value.value = ''
  if (inputAnexo.value) inputAnexo.value.value = ''
}

/** Só define preview local — upload B2 + banco só no Salvar. Uma mídia por anotação. */
function selecionarArquivo(file: File | null | undefined) {
  if (!file) return
  limparArquivo()
  arquivo.value = file
  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    previewUrl.value = URL.createObjectURL(file)
  }
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  selecionarArquivo(input.files?.[0])
}

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const msg = String((err as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
    if (msg.trim()) return msg
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível salvar a anotação.'
}

async function salvar() {
  if (enviando.value) return

  const key = conversaAtual.value?.trim()
  const canalId = activeCanalId.value
  const wsId = workspaceId.value
  const midia = arquivo.value

  if (!key) {
    toast.error('Selecione uma conversa.')
    return
  }
  if (canalId == null || canalId < 1) {
    toast.error('Canal não identificado.')
    return
  }
  if (wsId == null) {
    toast.error('Workspace não identificado.')
    return
  }
  if (!texto.value.trim() && !midia) {
    toast.error('Escreva um texto ou anexe uma mídia.')
    return
  }

  enviando.value = true
  try {
    await anotacoes.criar({
      workspaceId: wsId,
      canalId,
      conversaKey: key,
      texto: texto.value,
      arquivo: midia,
    })
    texto.value = ''
    limparArquivo()
    toast.success('Anotação salva.')
  } catch (err) {
    toast.error(mensagemErro(err))
  } finally {
    enviando.value = false
  }
}

async function gravarAgora() {
  if (enviando.value || isRecording.value) return
  await startRecording()
}

/** Finaliza gravação e deixa o áudio só como preview (ainda pode editar o texto). */
async function anexarAudioGravado() {
  if (!isRecording.value || enviando.value) return
  const audio = await stopAndGetAudio()
  if (!audio) return
  selecionarArquivo(audio.file)
}

onBeforeUnmount(() => {
  limparArquivo()
})
</script>

<template>
  <section class="border-b border-outline-variant/10 px-6 pb-4 pt-4">
    <h3 class="mb-3 font-headline text-sm font-bold text-slate-900 dark:text-slate-100">
      Anotações Internas
    </h3>
    <div class="flex flex-col gap-2">
      <textarea
        v-model="texto"
        class="h-20 w-full resize-none rounded-lg border border-outline/30 bg-white p-3 font-body text-xs text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
        placeholder="Adicionar anotação..."
        :disabled="controlesBloqueados"
      />

      <!-- Barra de gravação -->
      <div
        v-if="isRecording"
        class="flex items-center justify-between gap-2 rounded-xl border border-primary/25 bg-white px-3 py-2 dark:border-primary/30 dark:bg-dark-surface-container-low"
      >
        <div class="flex min-w-0 items-center gap-2 text-xs font-medium text-on-surface dark:text-dark-on-surface">
          <span
            class="h-2 w-2 shrink-0 rounded-full bg-rose-500"
            :class="isPaused ? '' : 'animate-pulse'"
            aria-hidden="true"
          />
          <span>{{ isPaused ? 'Pausado' : 'Gravando' }}… {{ formatRecordTime(recordSeconds) }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            aria-label="Cancelar gravação"
            @click="cancelRecording"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            :aria-label="isPaused ? 'Continuar gravação' : 'Pausar gravação'"
            @click="togglePauseRecording"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
              {{ isPaused ? 'play_arrow' : 'pause' }}
            </span>
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
            aria-label="Usar áudio gravado"
            :disabled="enviando"
            @click="anexarAudioGravado"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
          </button>
        </div>
      </div>

      <div
        v-else-if="arquivo"
        class="flex items-center gap-2 rounded-lg border border-outline/30 bg-white px-2 py-1.5 text-[11px] dark:border-dark-outline/30 dark:bg-dark-surface-container-low"
      >
        <img
          v-if="tipoPreview === 'imagem' && previewUrl"
          :src="previewUrl"
          alt=""
          class="h-10 w-10 rounded object-cover"
        />
        <video
          v-else-if="tipoPreview === 'video' && previewUrl"
          :src="previewUrl"
          class="h-10 w-14 rounded object-cover"
          muted
        />
        <audio
          v-else-if="tipoPreview === 'audio' && previewUrl"
          :src="previewUrl"
          class="h-8 max-w-[9rem]"
          controls
        />
        <span
          v-else
          class="material-symbols-outlined text-base text-on-surface-variant"
          aria-hidden="true"
        >
          description
        </span>
        <span class="min-w-0 flex-1 truncate text-on-surface dark:text-dark-on-surface">
          {{ nomeArquivo }}
        </span>
        <button
          type="button"
          class="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-rose-600 disabled:opacity-40"
          :disabled="enviando"
          aria-label="Remover anexo"
          @click="limparArquivo"
        >
          <span class="material-symbols-outlined text-sm" aria-hidden="true">close</span>
        </button>
      </div>

      <div v-if="!isRecording" class="flex items-center justify-between">
        <div class="flex gap-2 text-on-surface-variant dark:text-slate-400">
          <input
            ref="inputImagem"
            type="file"
            class="sr-only"
            accept="image/*"
            @change="onFileChange"
          />
          <input
            ref="inputAudio"
            type="file"
            class="sr-only"
            accept="audio/*"
            @change="onFileChange"
          />
          <input
            ref="inputVideo"
            type="file"
            class="sr-only"
            accept="video/*"
            @change="onFileChange"
          />
          <input
            ref="inputAnexo"
            type="file"
            class="sr-only"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf"
            @change="onFileChange"
          />

          <button
            type="button"
            class="hover:text-primary disabled:opacity-40"
            :disabled="enviando"
            aria-label="Imagem"
            @click="inputImagem?.click()"
          >
            <span class="material-symbols-outlined text-sm" aria-hidden="true">image</span>
          </button>

          <BaseDropdown
            title="Áudio"
            align="left"
            side="top"
            panel-class="w-56 min-w-[13rem]"
          >
            <template #trigger>
              <span
                class="inline-flex hover:text-primary"
                :class="enviando ? 'pointer-events-none opacity-40' : ''"
                aria-label="Áudio"
              >
                <span class="material-symbols-outlined text-sm" aria-hidden="true">mic</span>
              </span>
            </template>
            <template #default="{ close }">
              <div class="flex flex-col gap-1 p-1">
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="() => { close(); inputAudio?.click() }"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">folder_open</span>
                  Escolher do computador
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="() => { close(); void gravarAgora() }"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">mic</span>
                  Gravar agora
                </button>
              </div>
            </template>
          </BaseDropdown>

          <button
            type="button"
            class="hover:text-primary disabled:opacity-40"
            :disabled="enviando"
            aria-label="Vídeo"
            @click="inputVideo?.click()"
          >
            <span class="material-symbols-outlined text-sm" aria-hidden="true">videocam</span>
          </button>
          <button
            type="button"
            class="hover:text-primary disabled:opacity-40"
            :disabled="enviando"
            aria-label="Anexo"
            @click="inputAnexo?.click()"
          >
            <span class="material-symbols-outlined text-sm" aria-hidden="true">attachment</span>
          </button>
        </div>

        <button
          type="button"
          class="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="enviando"
          @click="salvar"
        >
          {{ enviando ? 'Enviando…' : 'Salvar' }}
        </button>
      </div>
    </div>
  </section>
</template>
