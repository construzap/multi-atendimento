export type TextoLinkSegmento =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }

/** URLs http(s) em texto livre (chat). */
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi

function limparUrlMatch(raw: string): { display: string; href: string; trailing: string } {
  let href = raw
  let trailing = ''
  while (href.length > 0 && /[.,;:!?)]$/.test(href)) {
    trailing = href.slice(-1) + trailing
    href = href.slice(0, -1)
  }
  return { display: href, href, trailing }
}

/**
 * Quebra o texto em segmentos de texto puro e links clicáveis.
 * Preserva o restante do conteúdo (incluindo quebras de linha).
 */
export function segmentarTextoComLinks(texto: string): TextoLinkSegmento[] {
  const input = String(texto ?? '')
  if (!input) return []

  const out: TextoLinkSegmento[] = []
  let last = 0
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  let match: RegExpExecArray | null

  while ((match = re.exec(input)) != null) {
    const start = match.index
    if (start > last) {
      out.push({ type: 'text', value: input.slice(last, start) })
    }

    const raw = match[0] ?? ''
    const { display, href, trailing } = limparUrlMatch(raw)
    if (href) {
      out.push({ type: 'link', value: display, href })
    }
    if (trailing) {
      out.push({ type: 'text', value: trailing })
    }

    last = start + raw.length
  }

  if (last < input.length) {
    out.push({ type: 'text', value: input.slice(last) })
  }

  return out.length ? out : [{ type: 'text', value: input }]
}
