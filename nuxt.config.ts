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
    /** URL do webhook N8N para I.A nas instâncias (override: NUXT_URL_IA_N8N ou URL_IA_N8N no .env). */
    urlIaN8n: process.env.URL_IA_N8N || process.env.NUXT_URL_IA_N8N || '',
    /** URL do app multiatendimento para webhook na instância (override: NUXT_URL_MULTIATENDIMENTO_CONSTRUZAP). */
    urlMultiatendimentoConstruzap:
      process.env.URL_MULTIATENDIMENTO_CONSTRUZAP ||
      process.env.NUXT_URL_MULTIATENDIMENTO_CONSTRUZAP ||
      '',

    // --- Backblaze B2 (override: NUXT_B2_*) ---
    b2Endpoint: '',
    b2Region: '',
    b2KeyId: '',
    b2AppKey: '',
    b2BucketName: '',
    /** Bucket B2 para mídia de agendamento (default no código: multiatendimentoconstruzap). */
    b2AgendamentoBucketName: '',
    /** Bucket B2 para mídia de disparo em massa (default no código: multiatendimentoconstruzap). */
    b2DisparoEmMassaBucketName: '',
    /** Bucket B2 para fotos de produtos (default no código: produtosconstruzap). */
    b2ProdutosBucketName: '',

    // --- Pusher — só servidor (override: NUXT_PUSHER_SECRET) ---
    pusherSecret: '',

    // --- OpenAI — embeddings (override: NUXT_OPENAI_*) ---
    openaiApiKey: '',
    openaiEmbeddingModel: 'text-embedding-3-small',

    // --- Supabase Vector — 2º banco pgvector (override: NUXT_VECTOR_*) ---
    vectorSupabaseUrl: '',
    vectorSupabaseSecretKey: '',
    vectorDocumentsTable: 'documentsconstruzapmulti',
    /** Chave para POST /api/public/buscar-produtos (integrações externas). */
    vectorSearchApiKey: '',

    public: {
      // --- Pusher — browser + SSR (override: NUXT_PUBLIC_PUSHER_*) ---
      pusherAppId: '',
      pusherKey: '',
      pusherCluster: '',
      /** WhatsApp comercial (wa.me) — `.env`: NUXT_WHATSAPP_COMERCIAL_NUMERO, WHATSAPP_COMERCIAL_NUMERO ou NUXT_PUBLIC_WHATSAPP_COMERCIAL_NUMERO */
      whatsappComercialNumero:
        process.env.NUXT_WHATSAPP_COMERCIAL_NUMERO ||
        process.env.WHATSAPP_COMERCIAL_NUMERO ||
        process.env.NUXT_PUBLIC_WHATSAPP_COMERCIAL_NUMERO ||
        '',
    },
  },
  vite: {
    server: {
      allowedHosts: [
        'fondness-auction-peroxide.ngrok-free.dev',
        'whats.construzap.com',
      ],
    },
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
      exclude: ['/esqueci-senha', '/redefinir-senha', '/api/public/**']
    }
  }
})