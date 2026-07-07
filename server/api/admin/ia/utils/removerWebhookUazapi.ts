import { createError } from 'h3'
import type { H3Event } from 'h3'
import {
  extrairErroUazapi,
  headersUazapiWebhook,
  listarWebhooksInstanciaUazapi,
  normalizarUrlWebhook,
  urlsWebhookCoincidem,
  validarCredenciaisInstancia,
} from './uazapiWebhookComum'

export type UazapiWebhookDeletePayload = {
  action: 'delete'
  id: string
}

async function removerWebhookInstanciaUazapi(
  servidor: string,
  token: string,
  webhookId: string,
): Promise<void> {
  const { base, token: tok } = validarCredenciaisInstancia(servidor, token)
  const id = String(webhookId ?? '').trim()

  if (!id) return

  const url = `${base}/webhook`
  const body: UazapiWebhookDeletePayload = {
    action: 'delete',
    id,
  }

  try {
    await $fetch(url, {
      method: 'POST',
      headers: headersUazapiWebhook(tok),
      body,
    })
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: extrairErroUazapi(err, `Falha ao remover webhook da instância (id: ${id}).`),
    })
  }
}

export function requireUrlIaN8n(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const url = String(config.urlIaN8n ?? '').trim()

  if (!url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_IA_N8N não configurada no servidor.',
    })
  }

  return url
}

/**
 * Lista webhooks da instância (GET) e remove apenas o que corresponde a `URL_IA_N8N`.
 */
export async function removerWebhooksInstanciaIa(
  servidor: string,
  token: string,
  urlIaN8n: string,
): Promise<void> {
  const urlAlvo = normalizarUrlWebhook(urlIaN8n)
  if (!urlAlvo) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_IA_N8N não configurada no servidor.',
    })
  }

  const webhooks = await listarWebhooksInstanciaUazapi(servidor, token)
  const idsParaRemover = webhooks
    .filter((webhook) => urlsWebhookCoincidem(webhook.url, urlAlvo))
    .map((webhook) => webhook.id)

  if (!idsParaRemover.length) return

  for (const id of idsParaRemover) {
    await removerWebhookInstanciaUazapi(servidor, token, id)
  }
}
