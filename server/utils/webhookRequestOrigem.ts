export type WebhookRequestOrigem = 'ngrok' | 'producao' | 'outro'

/** Hosts conhecidos de produção (qualquer subdomínio construzap.com). */
const HOSTS_PRODUCAO = ['whats.construzap.com', 'construzap.com']

export function extrairRequestHost(requestUrl: string | null | undefined): string | null {
  const raw = requestUrl?.trim()
  if (!raw) return null
  try {
    return new URL(raw).host
  } catch {
    return null
  }
}

export function classificarRequestOrigem(
  requestUrl: string | null | undefined,
): WebhookRequestOrigem {
  const host = extrairRequestHost(requestUrl)?.toLowerCase() ?? ''
  if (!host) return 'outro'
  if (host.includes('ngrok')) return 'ngrok'
  if (HOSTS_PRODUCAO.some((h) => host === h || host.endsWith(`.${h}`))) return 'producao'
  return 'outro'
}

export function labelRequestOrigem(origem: WebhookRequestOrigem): string {
  const map: Record<WebhookRequestOrigem, string> = {
    ngrok: 'Dev (ngrok)',
    producao: 'Produção',
    outro: 'Outro host',
  }
  return map[origem]
}
