import { getRequestURL } from 'h3'

/**
 * GET /api/webhook — só para testar se a URL pública (ex.: ngrok) chega ao Nuxt.
 * A Uazapi envia **POST** com JSON; configure exatamente esta URL + POST no painel.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const publicUrl = `${url.origin}${url.pathname}`

  console.log('[webhook] GET (teste de túnel):', publicUrl)

  return {
    ok: true,
    hint: 'Se você vê este JSON, o Nuxt recebeu o pedido. A Uazapi deve usar POST nesta mesma URL.',
    configureNaUazapi: {
      url: publicUrl,
      method: 'POST',
      contentType: 'application/json',
    },
    checklist: [
      'ngrok: rodar na mesma porta do nuxt dev (ex.: ngrok http 3000).',
      'Painel Uazapi: URL do webhook = HTTPS do ngrok + /api/webhook (sem barra no fim).',
      'Cada vez que reinicia o ngrok sem domínio fixo, a URL muda — atualize na Uazapi.',
    ],
  }
})
