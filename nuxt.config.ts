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
    /** Bucket B2 para mídia de anotações de conversas (default no código: multiatendimentoconstruzap). */
    b2AnotacoesBucketName: '',
    /** Bucket B2 para fotos de produtos (default no código: produtosconstruzap). */
    b2ProdutosBucketName: '',
    /** Bucket B2 para mídia de mensagens prontas (default no código: mensagemprontas). */
    b2MensagemProntasBucketName: '',

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
    /**
     * Chave para POST /api/public/kanban-atualizacao (N8N → mover coluna / pedido / Pusher).
     * Override: NUXT_N8N_KANBAN_API_KEY
     */
    n8nKanbanApiKey: '',

    // --- Agente IA (N8N → POST /api/public/agente/responder) ---
    /** Auth do endpoint do agente. Override: NUXT_N8N_AGENTE_API_KEY */
    n8nAgenteApiKey: process.env.NUXT_N8N_AGENTE_API_KEY || '',
    /**
     * Senha mestra para pgp_sym_decrypt(api_key_encrypted) em `canais`.
     * Override Nuxt (nome correto): NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY
     * Alias histórico (.env):       NUXT_AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY
     * Deixe vazio no build; o valor vem do ambiente do container.
     */
    agenteSenhaMestraEncriptografiaApiKey: '',
    /** Modelo OpenAI do agent loop (fallback se canal.model_name vazio). Override: NUXT_OPENAI_AGENT_MODEL */
    openaiAgentModel:
      process.env.NUXT_OPENAI_AGENT_MODEL || 'gpt-4.1-mini-2025-04-14',
    /** Máximo de rodadas tool_calls no loop. Override: NUXT_AGENTE_MAX_TOOL_ROUNDS */
    agenteMaxToolRounds: process.env.NUXT_AGENTE_MAX_TOOL_ROUNDS || '8',
    /** Janela de mensagens de memória. Override: NUXT_AGENTE_CONTEXT_WINDOW */
    agenteContextWindow: process.env.NUXT_AGENTE_CONTEXT_WINDOW || '26',
    /** URLs HTTP das tools (webhooks N8N). Override: NUXT_AGENTE_TOOL_*_URL */
    agenteToolEstoqueUrl: process.env.NUXT_AGENTE_TOOL_ESTOQUE_URL || '',
    agenteToolEnviaLocalizacaoUrl:
      process.env.NUXT_AGENTE_TOOL_ENVIA_LOCALIZACAO_URL || '',
    agenteToolFreteUrl: process.env.NUXT_AGENTE_TOOL_FRETE_URL || '',
    agenteToolGravarInfoClienteUrl:
      process.env.NUXT_AGENTE_TOOL_GRAVAR_INFO_CLIENTE_URL ||
      'https://nwebhook.construzap.com/webhook/be57b60b-1d5f-4e22-a377-e3f9e36e05f0',
    agenteToolOrcamentoProntoUrl:
      process.env.NUXT_AGENTE_TOOL_ORCAMENTO_PRONTO_URL || '',
    /**
     * Webhook: transferir atendimento para humano.
     * Override: NUXT_AGENTE_TOOL_TRANSFERIR_ATENDIMENTO
     */
    agenteToolTransferirAtendimento:
      process.env.NUXT_AGENTE_TOOL_TRANSFERIR_ATENDIMENTO || '',
    /** Header opcional comum aos webhooks das tools. */
    agenteToolHttpHeaderName: process.env.NUXT_AGENTE_TOOL_HTTP_HEADER_NAME || '',
    agenteToolHttpHeaderValue:
      process.env.NUXT_AGENTE_TOOL_HTTP_HEADER_VALUE || '',

    public: {
      /** Nome na aba do navegador. Override: NUXT_PUBLIC_APP_NAME */
      appName: process.env.NUXT_PUBLIC_APP_NAME || '',
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

      // --- Planos I.A (override: NUXT_PUBLIC_PLANO_*) ---
      /** Base mensal do Plano Iniciante (R$). */
      planoInicianteBase: 100,
      /** Valor por produto adicional no Plano Iniciante (R$). */
      planoIniciantePorProduto: 1,
      /** Valor por canal no Plano Iniciante (R$). */
      planoIniciantePorCanal: 50,
      /** Valor mensal fixo do Plano Intermediário (R$). */
      planoIntermediario: 399,
      /** Valor por canal no Plano Intermediário (R$). */
      planoIntermediarioPorCanal: 50,
      /** Valor mensal fixo do Plano Avançado (R$). */
      planoAvancado: 600,
      /** Valor por canal no Plano Avançado (R$). */
      planoAvancadoPorCanal: 50,
    },
  },
  vite: {
    server: {
      strictPort: true,
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
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg',
        },
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