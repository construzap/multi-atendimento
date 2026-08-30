/**
 * GET /api/webhook/webhookcobrancarecebida/cobrancarebecidaAsaas
 *
 * Só para testar se a URL pública (ngrok / produção) chega ao Nuxt.
 * O Asaas envia POST nesta mesma URL.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const publicUrl = `${url.origin}${url.pathname}`

  console.log('[webhook cobranca Asaas] GET (teste de túnel):', publicUrl)

  return {
    ok: true,
    hint: 'Se você vê este JSON, o Nuxt recebeu o pedido. Configure POST nesta mesma URL no Asaas.',
    configureNoAsaas: {
      url: publicUrl,
      method: 'POST',
      contentType: 'application/json',
    },
  }
})
