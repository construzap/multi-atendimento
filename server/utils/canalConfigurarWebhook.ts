import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extrairErroUazapi,
  headersUazapiWebhook,
  listarWebhooksInstanciaUazapi,
  validarCredenciaisInstancia,
} from '../api/admin/ia/utils/uazapiWebhookComum'
import { checkChannel } from './checkChannel'
import { getAuthUserId } from './getAuthUserId'

type UazapiWebhookAddPayload = {
  action: 'add'
  enabled: true
  url: string
  events: ['messages']
  excludeMessages: ['isGroupYes']
}

type UazapiWebhookDeletePayload = {
  action: 'delete'
  id: string
}

export type CanalWebhookCredenciais = {
  canalId: number
  token: string
  servidor: string
}

function parseCanalId(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Informe id_canal no body.' })
  }
  return n
}

/** Lê a variável direto do `.env` atual. O runtimeConfig fica com o valor de quando o servidor subiu. */
function urlDoArquivoEnv(nome: string): string {
  try {
    const texto = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const linha of texto.split(/\r?\n/)) {
      const t = linha.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 1) continue
      if (t.slice(0, eq).trim() !== nome) continue
      return t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {
    return ''
  }
  return ''
}

function urlConfigurada(
  event: H3Event,
  nomeEnv: string,
  chaveRuntime: 'urlIaN8n' | 'urlMultiatendimentoConstruzap',
  mensagem: string,
): string {
  const doArquivo = urlDoArquivoEnv(nomeEnv)
  const doProcesso = String(process.env[nomeEnv] ?? '').trim()
  const daRuntime = String(useRuntimeConfig(event)[chaveRuntime] ?? '').trim()
  const url = doArquivo || doProcesso || daRuntime
  if (!url) {
    throw createError({ statusCode: 500, statusMessage: mensagem })
  }
  return url
}

export function urlWebhookN8n(event: H3Event): string {
  return urlConfigurada(
    event,
    'URL_IA_N8N',
    'urlIaN8n',
    'URL_IA_N8N não configurada no servidor.',
  )
}

export function urlWebhookAplicativo(event: H3Event): string {
  return urlConfigurada(
    event,
    'URL_MULTIATENDIMENTO_CONSTRUZAP',
    'urlMultiatendimentoConstruzap',
    'URL_MULTIATENDIMENTO_CONSTRUZAP não configurada no servidor.',
  )
}

/** Usuário autenticado com acesso ao canal, e token/servidor da instância. */
export async function credenciaisCanalWebhook(event: H3Event): Promise<CanalWebhookCredenciais> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<{ id_canal?: unknown }>(event).catch(() => null)) ?? {}
  const canalId = parseCanalId(body.id_canal)

  const permitido = await checkChannel(event, canalId, userId)
  if (!permitido) {
    throw createError({ statusCode: 403, statusMessage: 'Você não tem permissão para acessar este canal.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  if (!canalRow) throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })

  const token = typeof canalRow.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow.servidor === 'string' ? canalRow.servidor.trim() : ''
  if (!token || !servidor) {
    throw createError({ statusCode: 400, statusMessage: 'Canal não possui token/servidor configurados.' })
  }

  return { canalId, token, servidor }
}

async function removerWebhookPorId(servidor: string, token: string, webhookId: string): Promise<void> {
  const { base, token: tok } = validarCredenciaisInstancia(servidor, token)
  const id = String(webhookId ?? '').trim()
  if (!id) return

  const body: UazapiWebhookDeletePayload = { action: 'delete', id }
  try {
    await $fetch(`${base}/webhook`, {
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

/** Lista e apaga todos os webhooks da instância. */
export async function removerTodosWebhooksInstancia(servidor: string, token: string): Promise<number> {
  const webhooks = await listarWebhooksInstanciaUazapi(servidor, token)
  for (const webhook of webhooks) {
    await removerWebhookPorId(servidor, token, webhook.id)
  }
  return webhooks.length
}

/** POST {servidor}/webhook com events messages, ignorando grupos. */
export async function adicionarWebhookInstancia(servidor: string, token: string, webhookUrl: string): Promise<void> {
  const { base, token: tok } = validarCredenciaisInstancia(servidor, token)
  const urlDestino = String(webhookUrl ?? '').trim()
  if (!urlDestino) {
    throw createError({ statusCode: 500, statusMessage: 'URL do webhook não configurada no servidor.' })
  }

  const body: UazapiWebhookAddPayload = {
    action: 'add',
    enabled: true,
    url: urlDestino,
    events: ['messages'],
    excludeMessages: ['isGroupYes'],
  }

  try {
    await $fetch(`${base}/webhook`, {
      method: 'POST',
      headers: headersUazapiWebhook(tok),
      body,
    })
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: extrairErroUazapi(err, `Falha ao registrar webhook da instância (${urlDestino}).`),
    })
  }
}
