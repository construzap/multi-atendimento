/**
 * POST /api/webhook/webhookcobrancarecebida/cobrancarebecidaAsaas
 *
 * Webhook público do Asaas (cobrança recebida). Ainda não processa nada —
 * só registra o payload no terminal para conferir se a URL está ativa.
 */
export default defineEventHandler(async (event) => {
  const started = new Date().toISOString()
  const reqUrl = getRequestURL(event)
  const ua = getRequestHeader(event, 'user-agent') ?? '(sem User-Agent)'

  console.log('\n────────── [webhook cobranca Asaas] POST recebido ──────────')
  console.log('hora (ISO):', started)
  console.log('URL:', reqUrl.href)
  console.log('User-Agent (trecho):', String(ua).slice(0, 120))

  let body: unknown = null
  try {
    body = await readBody(event)
  } catch (e) {
    console.error('[webhook cobranca Asaas] body inválido ou vazio:', e)
  }

  console.log('[webhook cobranca Asaas] payload completo (JSON):')
  console.log(JSON.stringify(body, null, 2))
  console.log('────────────────────────────────────────────────────────────\n')

  return { ok: true }
})
