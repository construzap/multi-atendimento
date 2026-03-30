GUIA ESSENCIAL ATUALIZADO – @nuxtjs/supabase (Nuxt 4)

Este arquivo é um guia de referência para uso do módulo @nuxtjs/supabase.
Sempre siga as decisões e instruções do desenvolvedor do projeto.

==================================================
1) INSTALAÇÃO
==================================================

Instale o módulo:

npx nuxi@latest module add supabase

Configure no nuxt.config.ts:

export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
})

==================================================
2) VARIÁVEIS DE AMBIENTE (V2+ / JWT SIGNING KEYS)
==================================================

Crie ou ajuste o arquivo .env:

SUPABASE_URL="https://example.supabase.co"

IMPORTANTE (v2+):
SUPABASE_KEY agora é a *publishable key*
(não mais a anon key no sentido antigo)

SUPABASE_KEY="<your_publishable_key>"

Para bypass de RLS no servidor (admin):
SUPABASE_SECRET_KEY="<your_secret_key>"

Legado (DEPRECATED – não use em novos projetos):
SUPABASE_SERVICE_KEY="<service_role_key>"

Observação:
Você pode usar NUXT_PUBLIC_ para trabalhar via runtimeConfig
(ex: NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY)

==================================================
3) CONFIGURAÇÃO RECOMENDADA DO MÓDULO
==================================================

export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],

  supabase: {
    useSsrCookies: true,

    redirect: true,

    redirectOptions: {
      login: '/login',
      callback: '/confirm',

      include: undefined,
      exclude: [],

      saveRedirectToCookie: false,
    },

    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: true,
    },

    // cookiePrefix: 'sb-{project-id}-auth-token'
    // types: './app/types/database.types.ts'
    // clientOptions: {}
  }
})

IMPORTANTE SOBRE useSsrCookies:
Quando useSsrCookies = true, NÃO é possível customizar:
- flowType
- autoRefreshToken
- detectSessionInUrl
- persistSession
- storage

Se precisar disso, use useSsrCookies = false (perde SSR automático).

==================================================
4) BREAKING CHANGE (V2)
==================================================

useSupabaseUser() NÃO retorna mais o User completo.
Agora retorna JWT Claims (auth.getClaims).

Se precisar do User completo:
use supabase.auth.getUser()

==================================================
5) AUTENTICAÇÃO (PKCE – FLUXO PADRÃO)
==================================================

O módulo exige duas páginas:
- /login
- /confirm

Configure no Supabase Dashboard:
Authentication > URL Configuration > Redirect URLs
Inclua a URL do /confirm (dev e produção).

==================================================
5.1) PÁGINA /login (OTP POR EMAIL)
==================================================

const supabase = useSupabaseClient()
const email = ref('')

async function signInWithOtp() {
  await supabase.auth.signInWithOtp({
    email: email.value,
    options: {
      emailRedirectTo: 'http://localhost:3000/confirm'
    }
  })
}

==================================================
5.2) PÁGINA /confirm
==================================================

const user = useSupabaseUser()

watch(user, () => {
  if (user.value) {
    navigateTo('/')
  }
}, { immediate: true })

==================================================
5.3) REDIRECIONAR PARA ROTA ORIGINAL (COOKIE)
==================================================

Ative no nuxt.config.ts:
saveRedirectToCookie: true

No /confirm:

const user = useSupabaseUser()
const redirectInfo = useSupabaseCookieRedirect()

watch(user, () => {
  if (user.value) {
    const path = redirectInfo.pluck()
    navigateTo(path || '/')
  }
}, { immediate: true })

==================================================
6) RESET DE SENHA
==================================================

ETAPA 1 – Solicitar reset:

supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://example.com/password/update'
})

ETAPA 2 – Atualizar senha:

supabase.auth.updateUser({
  password: newPassword
})

Opcional:
Escutar evento PASSWORD_RECOVERY via onAuthStateChange.

==================================================
7) COMPOSABLES PRINCIPAIS (CLIENT)
==================================================

useSupabaseClient()        -> cliente Supabase (supabase-js)
useSupabaseSession()       -> sessão reativa
useSupabaseUser()          -> JWT claims (v2)
useSupabaseCookieRedirect() -> controle manual de redirect

==================================================
8) MIDDLEWARE DE AUTH (QUANDO redirect = false)
==================================================

export default defineNuxtRouteMiddleware(() => {
  const session = useSupabaseSession()
  if (!session.value) navigateTo('/login')
})

Em páginas protegidas:
definePageMeta({ middleware: 'auth' })

==================================================
9) SERVER (NITRO) – USO NO BACKEND
==================================================

IMPORTANTE:
Em SSR com useFetch, sempre enviar cookies:
headers: useRequestHeaders(['cookie'])

--------------------------------------------------
9.1) serverSupabaseClient (RESPEITA RLS)
--------------------------------------------------

const client = await serverSupabaseClient(event)
await client.from('table').select('*')

--------------------------------------------------
9.2) serverSupabaseServiceRole (BYPASS RLS – ADMIN)
--------------------------------------------------

Usa SUPABASE_SECRET_KEY (recomendado)

const client = serverSupabaseServiceRole(event)
await client.from('protected_table').select('*')

--------------------------------------------------
9.3) serverSupabaseUser (USER NO SERVIDOR)
--------------------------------------------------

const user = await serverSupabaseUser(event)

==================================================
10) REALTIME (POSTGRES CHANGES)
==================================================

- Ative Realtime na tabela no Supabase
- Use client.channel(...).on('postgres_changes', ...)

==================================================
11) TYPESCRIPT – TIPOS DO BANCO
==================================================

Local padrão:
app/types/database.types.ts

Gerar tipos (remoto):
supabase gen types --lang=typescript --project-id PROJECT_ID > app/types/database.types.ts

Gerar tipos (local):
supabase gen types --lang=typescript --local > app/types/database.types.ts

==================================================
12) CHECKLIST FINAL
==================================================

- SUPABASE_KEY = publishable key (v2+)
- SUPABASE_SECRET_KEY apenas no servidor
- Redirect URLs configuradas no dashboard
- useSsrCookies true para SSR
- useSupabaseUser retorna CLAIMS, não User

FIM DO GUIA
