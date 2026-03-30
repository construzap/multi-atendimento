<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'

type TabId = 'login' | 'signup'

const activeTab = ref<TabId>('login')

const loginEmail = ref('')
const loginPassword = ref('')
const loginRemember = ref(false)
const showLoginPassword = ref(false)
const loginPending = ref(false)
const loginError = ref<string | null>(null)

const signupName = ref('')
const signupEmail = ref('')
const signupPhone = ref('')
const signupPassword = ref('')
const signupConfirm = ref('')
const showSignupPassword = ref(false)
const showSignupConfirm = ref(false)
const signupPending = ref(false)
const signupError = ref<string | null>(null)

async function onLoginSubmit() {
  loginError.value = null
  loginPending.value = true

  try {
    const { login } = useAuth()
    await login(loginEmail.value, loginPassword.value)
    await navigateTo('/')
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : 'Falha ao entrar. Tente novamente.'
  } finally {
    loginPending.value = false
  }
}

async function onSignupSubmit() {
  signupError.value = null
  signupPending.value = true

  try {
    const { createAccount } = useAuth()
    await createAccount({
      name: signupName.value,
      email: signupEmail.value,
      phone: signupPhone.value,
      password: signupPassword.value,
      confirmPassword: signupConfirm.value
    })

    await navigateTo('/')
  } catch (err) {
    signupError.value = err instanceof Error ? err.message : 'Falha ao criar conta. Tente novamente.'
  } finally {
    signupPending.value = false
  }
}
</script>

<template>
  <div
    id="login-right-section"
    class="flex flex-1 flex-col justify-center bg-surface-container-lowest px-6 py-10 md:px-12 lg:px-16"
  >
    <div class="mx-auto w-full max-w-md">
      <div
        class="mb-8 flex rounded-xl border border-gray-200 bg-gray-50/80 p-1"
        role="tablist"
        aria-label="Login ou cadastro"
      >
        <button
          id="tab-login"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'login'"
          aria-controls="panel-login"
          :tabindex="activeTab === 'login' ? 0 : -1"
          class="flex-1 rounded-lg py-3 text-sm font-semibold transition-all"
          :class="
            activeTab === 'login'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          "
          @click="activeTab = 'login'"
        >
          Entrar
        </button>
        <button
          id="tab-signup"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'signup'"
          aria-controls="panel-signup"
          :tabindex="activeTab === 'signup' ? 0 : -1"
          class="flex-1 rounded-lg py-3 text-sm font-semibold transition-all"
          :class="
            activeTab === 'signup'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          "
          @click="activeTab = 'signup'"
        >
          Cadastre-se
        </button>
      </div>

      <!-- Login -->
      <div
        v-show="activeTab === 'login'"
        id="panel-login"
        role="tabpanel"
        aria-labelledby="tab-login"
        class="space-y-5"
      >
        <form id="login-form" class="space-y-5" @submit.prevent="onLoginSubmit">
          <p v-if="loginError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ loginError }}
          </p>
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="login-email">Email</label>
            <BaseInput
              id="login-email"
              v-model="loginEmail"
              type="email"
              name="email"
              placeholder="seu@email.com"
              autocomplete="email"
            >
              <template #leading>
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </template>
            </BaseInput>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="login-password">Senha</label>
            <BaseInput
              id="login-password"
              v-model="loginPassword"
              :type="showLoginPassword ? 'text' : 'password'"
              name="password"
              placeholder="••••••••"
              autocomplete="current-password"
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
                  class="rounded p-1 text-gray-400 hover:text-gray-600"
                  :aria-label="showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showLoginPassword = !showLoginPassword"
                >
                  <svg v-if="!showLoginPassword" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M1 1l22 22" />
                    <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                  </svg>
                </button>
              </template>
            </BaseInput>
          </div>

          <div class="flex items-center justify-between">
            <label class="flex cursor-pointer items-center space-x-2">
              <input
                v-model="loginRemember"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-600">Lembrar-me</span>
            </label>
            <a href="#" class="text-sm font-semibold text-primary-600 hover:text-primary-700">Esqueceu a senha?</a>
          </div>

          <BaseButton id="btn-login-submit" type="submit" :disabled="loginPending">
            {{ loginPending ? 'Entrando...' : 'Entrar' }}
          </BaseButton>
        </form>
      </div>

      <!-- Cadastro -->
      <div
        v-show="activeTab === 'signup'"
        id="panel-signup"
        role="tabpanel"
        aria-labelledby="tab-signup"
        class="space-y-5"
      >
        <form id="cadastro-form" class="space-y-5" @submit.prevent="onSignupSubmit">
          <p v-if="signupError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ signupError }}
          </p>
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="signup-name">Nome Completo</label>
            <BaseInput
              id="signup-name"
              v-model="signupName"
              type="text"
              name="name"
              placeholder="Seu nome completo"
              autocomplete="name"
            >
              <template #leading>
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </template>
            </BaseInput>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="signup-email">Email</label>
            <BaseInput
              id="signup-email"
              v-model="signupEmail"
              type="email"
              name="email"
              placeholder="seu@email.com"
              autocomplete="email"
            >
              <template #leading>
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </template>
            </BaseInput>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="signup-phone">WhatsApp</label>
            <BaseInput
              id="signup-phone"
              v-model="signupPhone"
              type="tel"
              name="phone"
              placeholder="+55 (11) 99999-9999"
              autocomplete="tel"
            >
              <template #leading>
                <svg class="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                  />
                </svg>
              </template>
            </BaseInput>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="signup-password">Senha</label>
            <BaseInput
              id="signup-password"
              v-model="signupPassword"
              :type="showSignupPassword ? 'text' : 'password'"
              name="password"
              placeholder="••••••••"
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
                  class="rounded p-1 text-gray-400 hover:text-gray-600"
                  :aria-label="showSignupPassword ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showSignupPassword = !showSignupPassword"
                >
                  <svg v-if="!showSignupPassword" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700" for="signup-confirm">Confirmar Senha</label>
            <BaseInput
              id="signup-confirm"
              v-model="signupConfirm"
              :type="showSignupConfirm ? 'text' : 'password'"
              name="password_confirm"
              placeholder="••••••••"
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
                  class="rounded p-1 text-gray-400 hover:text-gray-600"
                  :aria-label="showSignupConfirm ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showSignupConfirm = !showSignupConfirm"
                >
                  <svg v-if="!showSignupConfirm" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

          <BaseButton id="btn-signup-submit" type="submit" :disabled="signupPending">
            {{ signupPending ? 'Criando...' : 'Criar Conta' }}
          </BaseButton>
        </form>
      </div>
    </div>
  </div>
</template>
