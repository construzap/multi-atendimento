import { createError } from 'h3'
import type { ProdutoAtualizarPlanilhaLinha } from '#shared/types/produtos'
import { normalizarCodigoBarras, normalizarCodigoExterno } from '#shared/utils/normalizarCodigoProduto'
import { resolverPrecoPrazo } from '#shared/utils/resolverPrecoPrazo'
import {
  resolverTermosDoLoteImportacao,
  sincronizarTermosVinculo,
} from './produtoTermosPesquisa'

type Admin = { from: (table: string) => any }

export const NOME_AGUARDANDO_ESCOLHA = 'Aguardando escolha'

export type DadosPlanilha = {
  codigo?: string
  codigo_barras_ean?: string
  nome?: string
  categoria?: string
  termos_pesquisa?: string[]
  sku?: string
  unidade_venda?: string
  marca?: string
  preco?: number
  preco_prazo?: number
  peso_kg?: number
  estoque?: number
  imagem_url?: string
  infos_relevantes?: string
  status?: boolean
}

export type CatalogoBarra = {
  id: number
  codigo_barras: string
  codigo_barras_norm: string
  nome: string | null
  imagem_url: string | null
  categoria: string | null
}

type Alvo = {
  id: number
  codigo: string | null
  tabelageral_id: number | null
  preco: number | null
  nome: string
  imagem_url: string | null
  categoria_id: number | null
  codigo_barras_ean: string | null
}

type CandidatoInsert = {
  origem: 'tabelageral' | 'workspace'
  tabelageral_id?: number
  produto_candidato_id?: number
}

type InsertPlano = {
  tipo: 'insert'
  virtualId: number
  row: Record<string, unknown>
  candidatos: CandidatoInsert[]
  categoria?: string
  termos?: string[]
}

type UpdatePlano = {
  tipo: 'update'
  id: number
  dados: DadosPlanilha
  precoAtual: number | null
  categoria?: string
  termos?: string[]
}

type Plano = InsertPlano | UpdatePlano

export type ResumoPlanilha = {
  atualizados: number
  nao_encontrados: number
  aguardando_escolha: number
}

function texto(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s.length ? s : null
}

function numOk(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null
  return raw
}

export function dadosDaLinha(linha: ProdutoAtualizarPlanilhaLinha): DadosPlanilha {
  const dados: DadosPlanilha = {}
  const codigo = normalizarCodigoExterno(linha.codigo)
  const barras = normalizarCodigoExterno(linha.codigo_barras_ean)
  const nome = texto(linha.nome)
  const categoria = texto(linha.categoria)
  const sku = texto(linha.sku)
  const unidade = texto(linha.unidade_venda)
  const marca = texto(linha.marca)
  const imagem = texto(linha.imagem_url)
  const infos = texto(linha.infos_relevantes)
  if (codigo) dados.codigo = codigo
  if (barras) dados.codigo_barras_ean = barras
  if (nome) dados.nome = nome
  if (categoria) dados.categoria = categoria
  if (sku) dados.sku = sku
  if (unidade) dados.unidade_venda = unidade
  if (marca) dados.marca = marca
  if (imagem && !imagem.startsWith('blob:')) dados.imagem_url = imagem
  if (infos) dados.infos_relevantes = infos
  const preco = numOk(linha.preco)
  const prazo = numOk(linha.preco_prazo)
  const peso = numOk(linha.peso_kg)
  const estoque = numOk(linha.estoque)
  if (preco != null) dados.preco = preco
  if (prazo != null) dados.preco_prazo = prazo
  if (peso != null) dados.peso_kg = peso
  if (estoque != null) dados.estoque = estoque
  if (typeof linha.status === 'boolean') dados.status = linha.status
  if (Array.isArray(linha.termos_pesquisa) && linha.termos_pesquisa.length) {
    dados.termos_pesquisa = linha.termos_pesquisa.map((t) => String(t).trim()).filter((t) => t.length > 0)
  }
  return dados
}

export function dadosDeJson(raw: unknown): DadosPlanilha {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return dadosDaLinha(raw as ProdutoAtualizarPlanilhaLinha)
}

function aplicarCampos(
  destino: Record<string, unknown>,
  dados: DadosPlanilha,
  precoAtual: number | null,
) {
  if (dados.nome) destino.nome = dados.nome
  if (dados.codigo) destino.codigo = dados.codigo
  if (dados.codigo_barras_ean) destino.codigo_barras_ean = dados.codigo_barras_ean
  if (dados.sku) destino.sku = dados.sku
  if (dados.unidade_venda) destino.unidade_venda = dados.unidade_venda
  if (dados.marca) destino.marca = dados.marca
  if (dados.imagem_url) destino.imagem_url = dados.imagem_url
  if (dados.infos_relevantes) destino.infos_relevantes = dados.infos_relevantes
  if (dados.preco != null) destino.preco = dados.preco
  if (dados.preco != null || dados.preco_prazo != null) {
    const precoBase = dados.preco != null ? dados.preco : precoAtual
    if (dados.preco_prazo != null || dados.preco != null) {
      if (dados.preco_prazo != null) {
        destino.preco_prazo = resolverPrecoPrazo(precoBase, dados.preco_prazo)
      }
    }
  }
  if (dados.peso_kg != null) destino.peso_kg = dados.peso_kg
  if (dados.estoque != null) destino.estoque = dados.estoque
  if (dados.status != null) destino.status = dados.status
}

function baseInsert(workspaceId: number, nome: string): Record<string, unknown> {
  return {
    workspace_id: workspaceId,
    nome,
    codigo: null,
    status: true,
    envia_foto: true,
    preco_custo: 0,
    largura: 0,
    altura: 0,
    comprimento: 0,
    nao_encontrado: false,
    aguardando_escolha: false,
    tabelageral_id: null,
    dados_atualizacao: null,
  }
}

async function mapaCategorias(admin: Admin, workspaceId: number): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from('produto_categorias')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const nome = String((row as { nome?: unknown }).nome ?? '').trim().toLowerCase()
    const id = Number((row as { id?: unknown }).id)
    if (!nome || !Number.isFinite(id)) continue
    if (!map.has(nome)) map.set(nome, id)
  }
  return map
}

function idCategoria(map: Map<string, number>, nome: string | undefined): number | null {
  if (!nome) return null
  return map.get(nome.trim().toLowerCase()) ?? null
}

async function gravarTermos(
  admin: Admin,
  workspaceId: number,
  produtoId: number,
  termos: string[] | undefined,
  termoIdPorNome: Map<string, number>,
) {
  if (!termos?.length) return
  const ids: number[] = []
  for (const nome of termos) {
    const id = termoIdPorNome.get(nome.toLowerCase())
    if (id) ids.push(id)
  }
  if (!ids.length) return
  await sincronizarTermosVinculo(admin, produtoId, ids)
}

export async function processarLotePlanilha(
  admin: Admin,
  workspaceId: number,
  linhas: ProdutoAtualizarPlanilhaLinha[],
  antesDeInserir?: (quantidade: number) => Promise<void>,
): Promise<ResumoPlanilha> {
  const preparados = linhas.map((linha) => ({
    linha,
    dados: dadosDaLinha(linha),
    barrasNorm: normalizarCodigoBarras(linha.codigo_barras_ean),
    codigo: normalizarCodigoExterno(linha.codigo),
  }))

  const normas = [...new Set(preparados.map((p) => p.barrasNorm).filter((v): v is string => !!v))]
  const codigos = [...new Set(preparados.map((p) => p.codigo).filter((v): v is string => !!v))]

  const catalogoPorNorm = new Map<string, CatalogoBarra[]>()
  if (normas.length) {
    const { data, error } = await admin
      .from('tabelageral')
      .select('id, codigo_barras, codigo_barras_norm, nome, imagem_url, categoria')
      .in('codigo_barras_norm', normas)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    for (const raw of data ?? []) {
      const row = raw as CatalogoBarra
      const norm = String(row.codigo_barras_norm ?? '')
      if (!norm) continue
      const lista = catalogoPorNorm.get(norm) ?? []
      lista.push({
        id: Number(row.id),
        codigo_barras: String(row.codigo_barras ?? ''),
        codigo_barras_norm: norm,
        nome: texto(row.nome),
        imagem_url: texto(row.imagem_url),
        categoria: texto(row.categoria),
      })
      catalogoPorNorm.set(norm, lista)
    }
  }

  const idsCatalogo = [...catalogoPorNorm.values()].flat().map((c) => c.id)
  const alvos: Alvo[] = []
  const vistos = new Set<number>()
  async function puxarAlvos(aplicar: (q: any) => any) {
    const { data, error } = await aplicar(
      admin
        .from('produtos_workspace')
        .select('id, codigo, tabelageral_id, preco, nome, imagem_url, categoria_id, codigo_barras_ean')
        .eq('workspace_id', workspaceId)
        .is('parent_id', null)
        .eq('aguardando_escolha', false),
    )
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    for (const raw of data ?? []) {
      const row = raw as Record<string, unknown>
      const id = Number(row.id)
      if (!Number.isFinite(id) || vistos.has(id)) continue
      vistos.add(id)
      const tg = row.tabelageral_id == null ? null : Number(row.tabelageral_id)
      const precoNum = row.preco == null ? null : Number(row.preco)
      alvos.push({
        id,
        codigo: normalizarCodigoExterno(row.codigo),
        tabelageral_id: tg != null && Number.isFinite(tg) ? tg : null,
        preco: precoNum != null && Number.isFinite(precoNum) ? precoNum : null,
        nome: String(row.nome ?? ''),
        imagem_url: texto(row.imagem_url),
        categoria_id: row.categoria_id == null ? null : Number(row.categoria_id),
        codigo_barras_ean: texto(row.codigo_barras_ean),
      })
    }
  }
  if (codigos.length) await puxarAlvos((q) => q.in('codigo', codigos))
  if (idsCatalogo.length) await puxarAlvos((q) => q.in('tabelageral_id', idsCatalogo))

  const porCodigo = new Map<string, Alvo[]>()
  const porTabelageral = new Map<number, Alvo[]>()
  function registrar(alvo: Alvo) {
    if (alvo.codigo) {
      const lista = porCodigo.get(alvo.codigo) ?? []
      lista.push(alvo)
      porCodigo.set(alvo.codigo, lista)
    }
    if (alvo.tabelageral_id != null) {
      const lista = porTabelageral.get(alvo.tabelageral_id) ?? []
      lista.push(alvo)
      porTabelageral.set(alvo.tabelageral_id, lista)
    }
  }
  for (const alvo of alvos) registrar(alvo)

  const planos: Plano[] = []
  const resumo: ResumoPlanilha = { atualizados: 0, nao_encontrados: 0, aguardando_escolha: 0 }
  let virtualSeq = 0

  function novoVirtual(): number {
    virtualSeq += 1
    return -virtualSeq
  }

  function fundirNoInsert(virtualId: number, dados: DadosPlanilha, categoria: string | undefined, termos: string[] | undefined) {
    const plano = planos.find((p): p is InsertPlano => p.tipo === 'insert' && p.virtualId === virtualId)
    if (!plano) return
    const precoAtual = typeof plano.row.preco === 'number' ? plano.row.preco : null
    aplicarCampos(plano.row, dados, precoAtual)
    if (categoria) plano.categoria = categoria
    if (termos?.length) plano.termos = termos
  }

  for (const item of preparados) {
    const { dados, barrasNorm, codigo } = item
    if (!barrasNorm && !codigo) continue

    if (barrasNorm) {
      const cats = catalogoPorNorm.get(barrasNorm) ?? []
      if (cats.length === 1) {
        const cat = cats[0]!
        const ligados = porTabelageral.get(cat.id) ?? []
        const reais = ligados.filter((a) => {
          const ins = a.id < 0
            ? planos.find((p): p is InsertPlano => p.tipo === 'insert' && p.virtualId === a.id)
            : null
          if (ins && ins.row.aguardando_escolha === true) return false
          return true
        })
        if (reais.length === 1) {
          const alvo = reais[0]!
          if (alvo.id < 0) {
            fundirNoInsert(alvo.id, dados, dados.categoria ?? cat.categoria ?? undefined, dados.termos_pesquisa)
            resumo.atualizados += 1
          } else {
            planos.push({
              tipo: 'update',
              id: alvo.id,
              dados,
              precoAtual: alvo.preco,
              categoria: dados.categoria ?? undefined,
              termos: dados.termos_pesquisa,
            })
            resumo.atualizados += 1
          }
          continue
        }
        if (reais.length > 1) {
          const virtualId = novoVirtual()
          const row = baseInsert(workspaceId, dados.nome || NOME_AGUARDANDO_ESCOLHA)
          aplicarCampos(row, dados, null)
          row.aguardando_escolha = true
          row.dados_atualizacao = dados
          row.codigo_barras_ean = dados.codigo_barras_ean || cat.codigo_barras
          planos.push({
            tipo: 'insert',
            virtualId,
            row,
            candidatos: reais.filter((a) => a.id > 0).map((a) => ({ origem: 'workspace' as const, produto_candidato_id: a.id })),
            categoria: dados.categoria,
            termos: dados.termos_pesquisa,
          })
          resumo.aguardando_escolha += 1
          continue
        }
        const virtualId = novoVirtual()
        const row = baseInsert(workspaceId, dados.nome || cat.nome || 'Produto')
        aplicarCampos(row, dados, null)
        row.tabelageral_id = cat.id
        if (!row.imagem_url && cat.imagem_url) row.imagem_url = cat.imagem_url
        if (!row.codigo_barras_ean) row.codigo_barras_ean = cat.codigo_barras
        planos.push({
          tipo: 'insert',
          virtualId,
          row,
          candidatos: [],
          categoria: dados.categoria || cat.categoria || undefined,
          termos: dados.termos_pesquisa,
        })
        registrar({
          id: virtualId,
          codigo: texto(row.codigo),
          tabelageral_id: cat.id,
          preco: typeof row.preco === 'number' ? row.preco : null,
          nome: String(row.nome),
          imagem_url: texto(row.imagem_url),
          categoria_id: null,
          codigo_barras_ean: texto(row.codigo_barras_ean),
        })
        resumo.atualizados += 1
        continue
      }
      if (cats.length > 1) {
        const virtualId = novoVirtual()
        const row = baseInsert(workspaceId, dados.nome || NOME_AGUARDANDO_ESCOLHA)
        aplicarCampos(row, dados, null)
        row.aguardando_escolha = true
        row.dados_atualizacao = dados
        planos.push({
          tipo: 'insert',
          virtualId,
          row,
          candidatos: cats.map((c) => ({ origem: 'tabelageral' as const, tabelageral_id: c.id })),
          categoria: dados.categoria,
          termos: dados.termos_pesquisa,
        })
        resumo.aguardando_escolha += 1
        continue
      }
    }

    if (codigo) {
      const achados = (porCodigo.get(codigo) ?? []).filter((a) => {
        if (a.id > 0) return true
        const ins = planos.find((p): p is InsertPlano => p.tipo === 'insert' && p.virtualId === a.id)
        return !ins || ins.row.aguardando_escolha !== true
      })
      if (achados.length === 1) {
        const alvo = achados[0]!
        if (alvo.id < 0) {
          fundirNoInsert(alvo.id, dados, dados.categoria, dados.termos_pesquisa)
          const ins = planos.find((p): p is InsertPlano => p.tipo === 'insert' && p.virtualId === alvo.id)
          if (ins?.row.nao_encontrado === true) resumo.nao_encontrados += 1
          else resumo.atualizados += 1
        } else {
          planos.push({
            tipo: 'update',
            id: alvo.id,
            dados,
            precoAtual: alvo.preco,
            categoria: dados.categoria,
            termos: dados.termos_pesquisa,
          })
          resumo.atualizados += 1
        }
        continue
      }
      if (achados.length > 1) {
        const virtualId = novoVirtual()
        const row = baseInsert(workspaceId, dados.nome || NOME_AGUARDANDO_ESCOLHA)
        aplicarCampos(row, dados, null)
        row.aguardando_escolha = true
        row.codigo = codigo
        row.dados_atualizacao = dados
        planos.push({
          tipo: 'insert',
          virtualId,
          row,
          candidatos: achados.filter((a) => a.id > 0).map((a) => ({ origem: 'workspace' as const, produto_candidato_id: a.id })),
          categoria: dados.categoria,
          termos: dados.termos_pesquisa,
        })
        resumo.aguardando_escolha += 1
        continue
      }
    }

    const virtualId = novoVirtual()
    const row = baseInsert(workspaceId, dados.nome || (codigo ? `Produto ${codigo}` : 'Produto não encontrado'))
    aplicarCampos(row, dados, null)
    row.nao_encontrado = true
    if (codigo) row.codigo = codigo
    planos.push({
      tipo: 'insert',
      virtualId,
      row,
      candidatos: [],
      categoria: dados.categoria,
      termos: dados.termos_pesquisa,
    })
    registrar({
      id: virtualId,
      codigo: codigo,
      tabelageral_id: null,
      preco: typeof row.preco === 'number' ? row.preco : null,
      nome: String(row.nome),
      imagem_url: texto(row.imagem_url),
      categoria_id: null,
      codigo_barras_ean: texto(row.codigo_barras_ean),
    })
    resumo.nao_encontrados += 1
  }

  const criacoes = planos.filter((p) => p.tipo === 'insert').length
  if (criacoes > 0 && antesDeInserir) await antesDeInserir(criacoes)

  const categorias = await mapaCategorias(admin, workspaceId)
  const nomesTermos = [
    ...new Set(
      planos.flatMap((p) => p.termos ?? []).map((t) => t.trim()).filter((t) => t.length > 0),
    ),
  ]
  const termoIdPorNome = nomesTermos.length
    ? await resolverTermosDoLoteImportacao(admin, workspaceId, nomesTermos)
    : new Map<string, number>()

  const virtualParaReal = new Map<number, number>()

  for (const plano of planos) {
    if (plano.tipo === 'insert') {
      const catId = idCategoria(categorias, plano.categoria)
      if (catId) plano.row.categoria_id = catId
      const { data, error } = await admin.from('produtos_workspace').insert(plano.row).select('id').single()
      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      const id = Number((data as { id?: unknown }).id)
      if (!Number.isFinite(id)) throw createError({ statusCode: 500, statusMessage: 'Falha ao gravar produto.' })
      virtualParaReal.set(plano.virtualId, id)
      if (plano.candidatos.length) {
        const rows = plano.candidatos
          .map((c) => ({
            produto_id: id,
            origem: c.origem,
            tabelageral_id: c.tabelageral_id ?? null,
            produto_candidato_id:
              c.produto_candidato_id != null && c.produto_candidato_id < 0
                ? virtualParaReal.get(c.produto_candidato_id) ?? null
                : c.produto_candidato_id ?? null,
          }))
          .filter((c) => (c.origem === 'tabelageral' ? c.tabelageral_id : c.produto_candidato_id))
        if (rows.length) {
          const { error: errC } = await admin.from('produto_escolha_candidato').insert(rows)
          if (errC) throw createError({ statusCode: 500, statusMessage: errC.message })
        }
      }
      await gravarTermos(admin, workspaceId, id, plano.termos, termoIdPorNome)
      continue
    }

    const produtoId = plano.id < 0 ? virtualParaReal.get(plano.id) : plano.id
    if (!produtoId) continue
    const patch: Record<string, unknown> = { nao_encontrado: false }
    aplicarCampos(patch, plano.dados, plano.precoAtual)
    const catId = idCategoria(categorias, plano.categoria)
    if (catId) patch.categoria_id = catId
    const { error } = await admin
      .from('produtos_workspace')
      .update(patch)
      .eq('id', produtoId)
      .eq('workspace_id', workspaceId)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    await gravarTermos(admin, workspaceId, produtoId, plano.termos, termoIdPorNome)
  }

  return resumo
}

export async function aplicarEscolhaPlanilha(
  admin: Admin,
  workspaceId: number,
  produtoId: number,
  candidatoId: number,
): Promise<{ ainda_pendente: boolean }> {
  const { data: pendente, error: errP } = await admin
    .from('produtos_workspace')
    .select('id, nome, imagem_url, categoria_id, codigo_barras_ean, preco, dados_atualizacao, aguardando_escolha')
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
    .eq('aguardando_escolha', true)
    .maybeSingle()
  if (errP) throw createError({ statusCode: 500, statusMessage: errP.message })
  if (!pendente) throw createError({ statusCode: 404, statusMessage: 'Produto pendente não encontrado.' })

  const { data: cand, error: errC } = await admin
    .from('produto_escolha_candidato')
    .select('id, origem, tabelageral_id, produto_candidato_id')
    .eq('id', candidatoId)
    .eq('produto_id', produtoId)
    .maybeSingle()
  if (errC) throw createError({ statusCode: 500, statusMessage: errC.message })
  if (!cand) throw createError({ statusCode: 404, statusMessage: 'Candidato não encontrado.' })

  const dados = dadosDeJson((pendente as { dados_atualizacao?: unknown }).dados_atualizacao)
  const origem = String((cand as { origem?: unknown }).origem)

  if (origem === 'workspace') {
    const destinoId = Number((cand as { produto_candidato_id?: unknown }).produto_candidato_id)
    if (!Number.isFinite(destinoId) || destinoId < 1) {
      throw createError({ statusCode: 400, statusMessage: 'Candidato inválido.' })
    }
    const { data: destino, error: errD } = await admin
      .from('produtos_workspace')
      .select('id, preco')
      .eq('id', destinoId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (errD) throw createError({ statusCode: 500, statusMessage: errD.message })
    if (!destino) throw createError({ statusCode: 404, statusMessage: 'Produto escolhido não encontrado.' })
    await gravarDadosEscolha(admin, workspaceId, destinoId, dados, Number((destino as { preco?: unknown }).preco))
    const { error: errDel } = await admin.from('produtos_workspace').delete().eq('id', produtoId).eq('workspace_id', workspaceId)
    if (errDel) throw createError({ statusCode: 500, statusMessage: errDel.message })
    return { ainda_pendente: false }
  }

  const tabelageralId = Number((cand as { tabelageral_id?: unknown }).tabelageral_id)
  if (!Number.isFinite(tabelageralId) || tabelageralId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Candidato inválido.' })
  }

  const { data: ligados, error: errL } = await admin
    .from('produtos_workspace')
    .select('id, preco')
    .eq('workspace_id', workspaceId)
    .eq('tabelageral_id', tabelageralId)
    .eq('aguardando_escolha', false)
    .is('parent_id', null)
    .neq('id', produtoId)
  if (errL) throw createError({ statusCode: 500, statusMessage: errL.message })
  const lista = (ligados ?? []) as { id: number; preco: number | null }[]

  if (lista.length > 1) {
    const { error: errDelC } = await admin.from('produto_escolha_candidato').delete().eq('produto_id', produtoId)
    if (errDelC) throw createError({ statusCode: 500, statusMessage: errDelC.message })
    const rows = lista.map((p) => ({
      produto_id: produtoId,
      origem: 'workspace',
      tabelageral_id: null,
      produto_candidato_id: p.id,
    }))
    const { error: errIns } = await admin.from('produto_escolha_candidato').insert(rows)
    if (errIns) throw createError({ statusCode: 500, statusMessage: errIns.message })
    return { ainda_pendente: true }
  }

  if (lista.length === 1) {
    const destino = lista[0]!
    await gravarDadosEscolha(admin, workspaceId, destino.id, dados, destino.preco)
    const { error: errTg } = await admin
      .from('produtos_workspace')
      .update({ tabelageral_id: tabelageralId })
      .eq('id', destino.id)
      .eq('workspace_id', workspaceId)
    if (errTg) throw createError({ statusCode: 500, statusMessage: errTg.message })
    const { error: errDel } = await admin.from('produtos_workspace').delete().eq('id', produtoId).eq('workspace_id', workspaceId)
    if (errDel) throw createError({ statusCode: 500, statusMessage: errDel.message })
    return { ainda_pendente: false }
  }

  const { data: cat, error: errCat } = await admin
    .from('tabelageral')
    .select('id, nome, imagem_url, categoria, codigo_barras')
    .eq('id', tabelageralId)
    .maybeSingle()
  if (errCat) throw createError({ statusCode: 500, statusMessage: errCat.message })

  const pend = pendente as {
    nome?: unknown
    imagem_url?: unknown
    categoria_id?: unknown
    codigo_barras_ean?: unknown
    preco?: unknown
  }
  const patch: Record<string, unknown> = {
    aguardando_escolha: false,
    nao_encontrado: false,
    tabelageral_id: tabelageralId,
    dados_atualizacao: null,
  }
  const catalogo = cat as { nome?: unknown; imagem_url?: unknown; categoria?: unknown; codigo_barras?: unknown } | null
  if (String(pend.nome ?? '') === NOME_AGUARDANDO_ESCOLHA && texto(catalogo?.nome)) {
    patch.nome = texto(catalogo?.nome)
  }
  if (!texto(pend.imagem_url) && texto(catalogo?.imagem_url)) patch.imagem_url = texto(catalogo?.imagem_url)
  if (!texto(pend.codigo_barras_ean) && texto(catalogo?.codigo_barras)) {
    patch.codigo_barras_ean = texto(catalogo?.codigo_barras)
  }
  const categorias = await mapaCategorias(admin, workspaceId)
  const catNome = texto(catalogo?.categoria)
  if ((pend.categoria_id == null || Number(pend.categoria_id) < 1) && catNome) {
    const catId = idCategoria(categorias, catNome)
    if (catId) patch.categoria_id = catId
  }
  const { error: errUp } = await admin
    .from('produtos_workspace')
    .update(patch)
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
  if (errUp) throw createError({ statusCode: 500, statusMessage: errUp.message })
  const { error: errDelC } = await admin.from('produto_escolha_candidato').delete().eq('produto_id', produtoId)
  if (errDelC) throw createError({ statusCode: 500, statusMessage: errDelC.message })
  return { ainda_pendente: false }
}

async function gravarDadosEscolha(
  admin: Admin,
  workspaceId: number,
  produtoId: number,
  dados: DadosPlanilha,
  precoAtual: number | null,
) {
  const patch: Record<string, unknown> = { nao_encontrado: false, dados_atualizacao: null }
  aplicarCampos(patch, dados, typeof precoAtual === 'number' && Number.isFinite(precoAtual) ? precoAtual : null)
  const categorias = await mapaCategorias(admin, workspaceId)
  const catId = idCategoria(categorias, dados.categoria)
  if (catId) patch.categoria_id = catId
  const { error } = await admin
    .from('produtos_workspace')
    .update(patch)
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (dados.termos_pesquisa?.length) {
    const termoIdPorNome = await resolverTermosDoLoteImportacao(admin, workspaceId, dados.termos_pesquisa)
    await gravarTermos(admin, workspaceId, produtoId, dados.termos_pesquisa, termoIdPorNome)
  }
}
