// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  /**
   * Opção 3 (porta / host): ngrok faz forward para 127.0.0.1:PORTA por padrão.
   * Só escutar em [::1] (IPv6) quebra isso — o browser em localhost pode funcionar e o webhook não.
   * `0.0.0.0` aceita IPv4 + IPv6 conforme o SO; porta fixa alinha com `ngrok http 3000`.
   */
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  runtimeConfig: {
    // --- Backblaze B2 (override: NUXT_B2_*) ---
    b2Endpoint: '',
    b2Region: '',
    b2KeyId: '',
    b2AppKey: '',
    b2BucketName: '',

    // --- Pusher — só servidor (override: NUXT_PUSHER_SECRET) ---
    pusherSecret: '',

    public: {
      // --- Pusher — browser + SSR (override: NUXT_PUBLIC_PUSHER_*) ---
      pusherAppId: '',
      pusherKey: '',
      pusherCluster: '',
    },
  },
  vite: {
    server: {
      allowedHosts: ['fondness-auction-peroxide.ngrok-free.dev']
    }
  },
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap'
        }
      ]
    }
  },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase', '@pinia/nuxt'],
  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/esqueci-senha', '/redefinir-senha']
    }
  }
})