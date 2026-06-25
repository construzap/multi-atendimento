import { createError } from 'h3'
import type { H3Event } from 'h3'

const MAX_BATCH = 100
const MAX_RETRIES = 3

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>
}

function getEmbeddingModel(event?: H3Event): string {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  const model = String(config.openaiEmbeddingModel ?? '').trim()
  return model || 'text-embedding-3-small'
}

export async function createEmbeddings(
  apiKey: string,
  texts: string[],
  event?: H3Event,
): Promise<number[][]> {
  const key = apiKey.trim()
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key não configurada (NUXT_OPENAI_API_KEY).',
    })
  }

  if (!texts.length) return []

  const model = getEmbeddingModel(event)
  const results: number[][] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH)
    const embeddings = await fetchEmbeddingsBatch(key, model, batch)
    for (let j = 0; j < embeddings.length; j++) {
      results[i + j] = embeddings[j]!
    }
  }

  return results
}

export async function createEmbedding(
  apiKey: string,
  text: string,
  event?: H3Event,
): Promise<number[]> {
  const [embedding] = await createEmbeddings(apiKey, [text], event)
  if (!embedding) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao gerar embedding.' })
  }
  return embedding
}

async function fetchEmbeddingsBatch(
  apiKey: string,
  model: string,
  batch: string[],
): Promise<number[][]> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: batch,
        }),
      })

      if (res.status === 429 && attempt < MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1))
        continue
      }

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`)
      }

      const json = (await res.json()) as OpenAIEmbeddingResponse
      const sorted = [...json.data].sort((a, b) => a.index - b.index)
      return sorted.map((item) => item.embedding)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES - 1) await sleep(500 * (attempt + 1))
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: lastError?.message ?? 'Erro ao contactar OpenAI.',
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
