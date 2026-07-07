<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import { validarSenhaUsuario } from '#shared/utils/validarSenhaUsuario'

const profile = useProfileStore()

const novaSenha = ref('')
const confirmarSenha = ref('')
const revogarOutrasSessoes = ref(true)
const showNova = ref(false)
const showConfirmar = ref(false)
const submitting = ref(false)

async function onAtualizar() {
  const senha = novaSenha.value
  const confirmacao = confirmarSenha.value

  if (senha !== confirmacao) {
    toast.warning('As senhas não conferem.')
    return
  }

  const validacao = validarSenhaUsuario(senha)
  if (!validacao.valida) {
    toast.warning(validacao.mensagem ?? 'Senha inválida.')
    return
  }

  submitting.value = true
  try {
    const resultado = await profile.updatePassword({
      new_password: senha,
      new_password_confirm: confirmacao,
      revogar_outras_sessoes: revogarOutrasSessoes.value,
    })
    novaSenha.value = ''
    confirmarSenha.value = ''
    if (resultado.aviso) {
      toast.warning(resultado.aviso)
    } else if (resultado.revogou_outras_sessoes) {
      toast.success('Senha atualizada. Outros acessos foram encerrados.')
    } else {
      toast.success('Senha atualizada com sucesso.')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao alterar senha.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div class="flex items-start gap-3">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger-container/80 dark:bg-danger-container/40">
          <svg class="h-6 w-6 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Alterar Senha
          </h3>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Mantenha sua conta segura com uma senha forte
          </p>
        </div>
      </div>
    </div>

    <div class="p-6">
      <form class="space-y-5" @submit.prevent="onAtualizar">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="nova-senha">
            Nova Senha
          </label>
          <BaseInput
            id="nova-senha"
            v-model="novaSenha"
            :type="showNova ? 'text' : 'password'"
            name="new_password"
            placeholder="Digite sua nova senha"
            autocomplete="new-password"
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M12 16v2M9 11V7a3 3 0 0 1 6 0v4" />
              </svg>
            </template>
            <template #trailing>
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:text-gray-600 dark:text-dark-on-surface-variant"
                :aria-label="showNova ? 'Ocultar senha' : 'Mostrar senha'"
                @click="showNova = !showNova"
              >
                <svg v-if="!showNova" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M1 1l22 22" />
                </svg>
              </button>
            </template>
          </BaseInput>
          <ul class="mt-2 space-y-1">
            <li class="flex items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              <svg class="h-3.5 w-3.5 shrink-0 text-outline-variant dark:text-dark-outline-variant" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
              </svg>
              Mínimo de 8 caracteres
            </li>
            <li class="flex items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              <svg class="h-3.5 w-3.5 shrink-0 text-outline-variant dark:text-dark-outline-variant" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
              </svg>
              Uma letra maiúscula
            </li>
            <li class="flex items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              <svg class="h-3.5 w-3.5 shrink-0 text-outline-variant dark:text-dark-outline-variant" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
              </svg>
              Um número
            </li>
            <li class="flex items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              <svg class="h-3.5 w-3.5 shrink-0 text-outline-variant dark:text-dark-outline-variant" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
              </svg>
              Um caractere especial
            </li>
          </ul>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="confirmar-senha">
            Confirmar Nova Senha
          </label>
          <BaseInput
            id="confirmar-senha"
            v-model="confirmarSenha"
            :type="showConfirmar ? 'text' : 'password'"
            name="new_password_confirm"
            placeholder="Confirme sua nova senha"
            autocomplete="new-password"
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M12 16v2M9 11V7a3 3 0 0 1 6 0v4" />
              </svg>
            </template>
            <template #trailing>
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:text-gray-600 dark:text-dark-on-surface-variant"
                :aria-label="showConfirmar ? 'Ocultar senha' : 'Mostrar senha'"
                @click="showConfirmar = !showConfirmar"
              >
                <svg v-if="!showConfirmar" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M1 1l22 22" />
                </svg>
              </button>
            </template>
          </BaseInput>
        </div>

        <label
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-outline/30 px-4 py-3 text-sm dark:border-dark-outline/30"
        >
          <input
            id="revogar-outras-sessoes"
            v-model="revogarOutrasSessoes"
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 rounded border-outline/50"
            :disabled="submitting || profile.pending"
          />
          <span>
            <span class="block font-semibold text-on-surface dark:text-dark-on-surface">
              Encerrar acessos em outros dispositivos
            </span>
            <span class="mt-1 block text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Desconecta sessões abertas em outros navegadores e aparelhos. Você permanece logado neste dispositivo.
            </span>
          </span>
        </label>

        <div class="pt-2">
          <BaseButton id="btn-perfil-atualizar-senha" type="submit" :disabled="submitting || profile.pending">
            {{ submitting || profile.pending ? 'Atualizando...' : 'Atualizar Senha' }}
          </BaseButton>
        </div>
      </form>
    </div>
  </section>
</template>
