import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  ProdutoEscolhaCandidato,
  ProdutoEscolhaPendente,
  ProdutosEscolhaPlanilhaListaResponse,
} from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function parseWorkspaceId(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function texto(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  return s.length ? s : null
}

/** GET /api/produtos/escolha-planilha?workspace_id= */
export default defineEventHandler(async (event): Promise<ProdutosEscolhaPlanilhaListaResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }
  const userId = getAuthUserId(authData.user)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const workspaceId = parseWorkspaceId(getQuery(event).workspace_id)
  await checkWorkspace(event, workspaceId, userId)
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: pendentes, error } = await admin
    .from('produtos_workspace')
    .select('id, nome, codigo, codigo_barras_ean, preco, imagem_url')
    .eq('workspace_id', workspaceId)
    .eq('aguardando_escolha', true)
    .order('id', { ascending: true })
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const produtos = (pendentes ?? []) as Record<string, unknown>[]
  if (!produtos.length) return { data: [] }

  const ids = produtos.map((p) => Number(p.id)).filter((id) => Number.isFinite(id))
  const { data: candidatos, error: errC } = await admin
    .from('produto_escolha_candidato')
    .select('id, produto_id, origem, tabelageral_id, produto_candidato_id')
    .in('produto_id', ids)
  if (errC) throw createError({ statusCode: 500, statusMessage: errC.message })

  const linhasC = (candidatos ?? []) as Record<string, unknown>[]
  const idsTabelageral = [...new Set(linhasC.map((c) => Number(c.tabelageral_id)).filter((id) => Number.isFinite(id) && id > 0))]
  const idsProdutos = [...new Set(linhasC.map((c) => Number(c.produto_candidato_id)).filter((id) => Number.isFinite(id) && id > 0))]

  const catalogo = new Map<number, Record<string, unknown>>()
  if (idsTabelageral.length) {
    const { data, error: errT } = await admin
      .from('tabelageral')
      .select('id, nome, codigo_barras, categoria, imagem_url')
      .in('id', idsTabelageral)
    if (errT) throw createError({ statusCode: 500, statusMessage: errT.message })
    for (const row of data ?? []) catalogo.set(Number((row as { id: number }).id), row as Record<string, unknown>)
  }

  const produtosC = new Map<number, Record<string, unknown>>()
  if (idsProdutos.length) {
    const { data, error: errW } = await admin
      .from('produtos_workspace')
      .select('id, nome, codigo, codigo_barras_ean, preco, imagem_url')
      .eq('workspace_id', workspaceId)
      .in('id', idsProdutos)
    if (errW) throw createError({ statusCode: 500, statusMessage: errW.message })
    for (const row of data ?? []) produtosC.set(Number((row as { id: number }).id), row as Record<string, unknown>)
  }

  const porProduto = new Map<number, ProdutoEscolhaCandidato[]>()
  for (const c of linhasC) {
    const produtoId = Number(c.produto_id)
    const origem = c.origem === 'workspace' ? 'workspace' : 'tabelageral'
    let item: ProdutoEscolhaCandidato | null = null
    if (origem === 'tabelageral') {
      const cat = catalogo.get(Number(c.tabelageral_id))
      if (!cat) continue
      item = {
        id: Number(c.id),
        origem,
        nome: String(cat.nome ?? 'Produto'),
        codigo: null,
        codigo_barras: texto(cat.codigo_barras),
        categoria: texto(cat.categoria),
        imagem_url: texto(cat.imagem_url),
        preco: null,
      }
    } else {
      const prod = produtosC.get(Number(c.produto_candidato_id))
      if (!prod) continue
      const preco = prod.preco == null ? null : Number(prod.preco)
      item = {
        id: Number(c.id),
        origem,
        nome: String(prod.nome ?? 'Produto'),
        codigo: texto(prod.codigo),
        codigo_barras: texto(prod.codigo_barras_ean),
        categoria: null,
        imagem_url: texto(prod.imagem_url),
        preco: preco != null && Number.isFinite(preco) ? preco : null,
      }
    }
    const lista = porProduto.get(produtoId) ?? []
    lista.push(item)
    porProduto.set(produtoId, lista)
  }

  const data: ProdutoEscolhaPendente[] = produtos.map((p) => {
    const preco = p.preco == null ? null : Number(p.preco)
    return {
      id: Number(p.id),
      nome: String(p.nome ?? ''),
      codigo: texto(p.codigo),
      codigo_barras_ean: texto(p.codigo_barras_ean),
      preco: preco != null && Number.isFinite(preco) ? preco : null,
      imagem_url: texto(p.imagem_url),
      candidatos: porProduto.get(Number(p.id)) ?? [],
    }
  })

  return { data }
})
