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
    ngrokContaGratuita: {
      aviso:
        'Abrir essa URL no Chrome costuma mostrar primeiro a página de aviso do ngrok ("You are about to visit…"). Isso NÃO é erro do app — o ngrok intercepta tráfego que parece navegador.',
      oQueFazerNoNavegador: 'Clique em "Visit Site" uma vez; depois pode aparecer este JSON.',
      testeSemPaginaDeAviso:
        'Use curl ou Postman com o header: ngrok-skip-browser-warning: qualquer-coisa (documentação ngrok).',
      webhooksPost:
        'Chamadas POST de servidor (ex.: Uazapi) em geral não passam por essa página; se nada aparece no terminal, confira o inspetor do ngrok em http://127.0.0.1:4040 e se a URL no painel da Uazapi está exatamente igual (HTTPS + /api/webhook).',
    },
    configureNaUazapi: {
      url: publicUrl,
      method: 'POST',
      contentType: 'application/json',
    },
    checklist: [
      'ngrok: rodar na mesma porta do nuxt dev (ex.: ngrok http 3000).',
      'Painel Uazapi: URL do webhook = HTTPS do ngrok + /api/webhook (sem barra no fim).',
      'Cada vez que reinicia o ngrok sem domínio fixo, a URL muda — atualize na Uazapi.',
      'Inspetor ngrok: http://127.0.0.1:4040 — lista cada request; se não aparece POST ao enviar WhatsApp, o problema é URL/evento fora do app.',
    ],
  }
})
