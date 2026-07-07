import { createError } from 'h3'
import type { H3Event } from 'h3'
import {
  extrairErroUazapi,
  headersUazapiWebhook,
  listarWebhooksInstanciaUazapi,
  validarCredenciaisInstancia,
  webhookUrlJaExiste,
} from './uazapiWebhookComum'

export type UazapiWebhookAddPayload = {
  action: 'add'
  enabled: true
  url: string
  events: ['messages']
  excludeMessages: ['isGroupYes']
}

export type AdminIaWebhookUrls = {
  urlIaN8n: string
  urlMultiatendimentoConstruzap: string
}

/**
 * Registra um webhook na instância Uazapi: **POST {servidor}/webhook**.
 * Headers: `Accept: application/json`, `token: {token}`.
 */
async function adicionarWebhookInstanciaUazapi(
  servidor: string,
  token: string,
  webhookUrl: string,
): Promise<void> {
  const { base, token: tok } = validarCredenciaisInstancia(servidor, token)
  const urlDestino = String(webhookUrl ?? '').trim()

  if (!urlDestino) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL do webhook não configurada no servidor.',
    })
  }

  const url = `${base}/webhook`
  const body: UazapiWebhookAddPayload = {
    action: 'add',
    enabled: true,
    url: urlDestino,
    events: ['messages'],
    excludeMessages: ['isGroupYes'],
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
      statusMessage: extrairErroUazapi(
        err,
        `Falha ao registrar webhook da instância (${urlDestino}).`,
      ),
    })
  }
}

/**
 * Registra os webhooks de I.A na instância (N8N + multiatendimento).
 * Faz GET antes e só adiciona URLs que ainda não existem.
 */
export async function adicionarWebhooksInstanciaIa(
  servidor: string,
  token: string,
  webhookUrls: string[],
): Promise<void> {
  const urls = webhookUrls.map((u) => String(u ?? '').trim()).filter(Boolean)
  if (!urls.length) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Nenhuma URL de webhook configurada no servidor.',
    })
  }

  const webhooksExistentes = await listarWebhooksInstanciaUazapi(servidor, token)

  for (const webhookUrl of urls) {
    if (webhookUrlJaExiste(webhooksExistentes, webhookUrl)) continue
    await adicionarWebhookInstanciaUazapi(servidor, token, webhookUrl)
  }
}

export function requireUrlsWebhookIa(event: H3Event): AdminIaWebhookUrls {
  const config = useRuntimeConfig(event)
  const urlIaN8n = String(config.urlIaN8n ?? '').trim()
  const urlMultiatendimentoConstruzap = String(config.urlMultiatendimentoConstruzap ?? '').trim()

  if (!urlIaN8n) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_IA_N8N não configurada no servidor.',
    })
  }

  if (!urlMultiatendimentoConstruzap) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_MULTIATENDIMENTO_CONSTRUZAP não configurada no servidor.',
    })
  }

  return { urlIaN8n, urlMultiatendimentoConstruzap }
}
