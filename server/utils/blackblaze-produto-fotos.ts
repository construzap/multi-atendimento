import { createError } from 'h3'
import { mimeToExt } from './b2Storage'

/** Bucket público para fotos de produtos (override: `NUXT_B2_PRODUTOS_BUCKET_NAME`). */
export const PRODUTO_FOTOS_B2_BUCKET_PADRAO = 'produtosconstruzap'

const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const MAX_FOTOS_POR_REQUISICAO = 10

export function normalizarMimeImagemProduto(s: string): string {
  const m = (s.split(';')[0] ?? '').trim().toLowerCase()
  if (!m || !MIMES_IMAGEM.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido (use jpeg, png, webp ou gif).',
    })
  }
  return m
}

export function resolverBucketProdutoFotos(b2ProdutosBucketName: string | undefined): string {
  const t = String(b2ProdutosBucketName ?? '').trim()
  return t.length > 0 ? t : PRODUTO_FOTOS_B2_BUCKET_PADRAO
}

export function chaveObjetoProdutoFoto(
  workspaceId: number,
  produtoId: number,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  return `produtos-fotos/${workspaceId}/${produtoId}/${Date.now()}_${rand}${ext}`
}

/** Mensagem amigável para erros comuns do B2 (ex.: key sem permissão no bucket). */
export function mensagemErroB2ProdutoFotos(erro: unknown, bucket: string): string {
  const raw = erro instanceof Error ? erro.message : String(erro ?? '')
  const lower = raw.toLowerCase()
  if (lower.includes('not entitled') || lower.includes('access denied') || lower.includes('403')) {
    return (
      `A chave B2 (NUXT_B2_KEY_ID) não tem permissão de escrita no bucket «${bucket}». ` +
      'No painel Backblaze: crie o bucket «produtosconstruzap» (se ainda não existir) e edite a Application Key ' +
      'para incluir esse bucket com read/write/delete, ou use uma key com acesso a todos os buckets.'
    )
  }
  if (lower.includes('nosuchbucket') || lower.includes('no such bucket')) {
    return `O bucket B2 «${bucket}» não existe na conta. Crie-o no painel Backblaze.`
  }
  return raw || 'Falha no upload para o B2.'
}

/** Extrai a chave S3 a partir da URL pública do B2. */
export function extrairChaveB2DeUrlPublica(url: string, bucket: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('backblazeb2.com')) return null
    const prefix = `${bucket}.s3.`
    if (!u.hostname.startsWith(prefix)) return null
    const raw = u.pathname.replace(/^\//, '')
    if (!raw) return null
    return raw.split('/').map((p) => decodeURIComponent(p)).join('/')
  } catch {
    return null
  }
}
