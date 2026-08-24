# Cutover N8N → Agente no app

Substitua o cluster `agente4` + OpenAI Chat Model + Postgres Chat Memory + tools por **um HTTP Request**.

## Endpoint

`POST {URL_DO_APP}/api/public/agente/responder`

Headers:

- `Authorization: Bearer {{NUXT_N8N_AGENTE_API_KEY}}`  
  ou `x-api-key: {{NUXT_N8N_AGENTE_API_KEY}}`
- `Content-Type: application/json`

## Body (mapear a partir dos nós atuais)

```json
{
  "workspace_id": "{{ WORKSPACE - EMPRESA.workspace_id }}",
  "conversa_key": "{{ DADOS_CLIENTE_BANCO1.key }}",
  "canal_id": "{{ DADOS_CANAL.id }}",
  "mensagem": "{{ mensagemFinal }}",
  "name": "{{ DADOS_CLIENTE_BANCO1.name }}",
  "phone": "{{ DADOS_CLIENTE_BANCO1.phone }}",
  "property_prompt": "{{ property_prompt }}",
  "status_loja": "{{ WORKSPACE - EMPRESA.status_loja }}",
  "endereco": "{{ DADOS_CANAL.endereco }}",
  "horario_semana": "{{ WORKSPACE - EMPRESA.horario_semana }}",
  "horario_sabado": "{{ WORKSPACE - EMPRESA.horario_sabado }}",
  "horario_domingo": "{{ WORKSPACE - EMPRESA.horario_domingo }}",
  "latitude": "{{ DADOS_CANAL.latitude }}",
  "longitude": "{{ DADOS_CANAL.longitude }}",
  "numero": "{{ junta_dados_antes_resposta.numero }}",
  "UUID": "{{ junta_dados_antes_resposta.UUID }}",
  "apikey": "{{ DADOS_PRINCIPAL_WEBHOOK.apikey }}",
  "evoURL": "{{ DADOS_PRINCIPAL_WEBHOOK.evoURL }}",
  "url_uazapi": "{{ junta_dados_antes_resposta.url_uazapi }}",
  "phone_PARA_NOTIFICAR": "{{ junta_dados_antes_resposta.phone_PARA_NOTIFICAR }}",
  "name_canal_cliente": "{{ WORKSPACE - EMPRESA.name_cliente }}",
  "tempo_pausa": "{{ WORKSPACE - EMPRESA.tempo_pausa }}",
  "tempo_resposta": "{{ WORKSPACE - EMPRESA.tempo_resposta }}",
  "ai_assinatura_enabled": "{{ WORKSPACE - EMPRESA.ai_assinatura_enabled }}",
  "telefone": "{{ DADOS_PRINCIPAL_WEBHOOK.remoteJid }}",
  "email": null
}
```

`property_prompt` é opcional: se omitido, o app lê o `prompt_principal` do workspace no Supabase.

## Response

```json
{
  "ok": true,
  "reply_text": "...",
  "session_id": "{workspace_id}-{conversa_key}",
  "model": "gpt-4.1-mini-2025-04-14",
  "tool_trace": [],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 }
}
```

Use `reply_text` no nó que envia a mensagem no WhatsApp (no lugar da saída do `agente4`).

## Tools (continuam no N8N como webhooks)

Configure no `.env` do app as Production URLs:

| Env | Workflow / webhook |
|-----|--------------------|
| `NUXT_AGENTE_TOOL_ESTOQUE_URL` | ferramenta de estoque supabase |
| `NUXT_AGENTE_TOOL_ENVIA_LOCALIZACAO_URL` | envia localização loja |
| `NUXT_AGENTE_TOOL_FRETE_URL` | Calculadora de Frete |
| `NUXT_AGENTE_TOOL_ORCAMENTO_PRONTO_URL` | já preenchido (nwebhook orçamento) |

Cada workflow tool precisa de um **Webhook Trigger** (ou URL de produção) que aceite o mesmo JSON de inputs que o `toolWorkflow` recebia.

## Checklist piloto

1. Preencher URLs das tools no `.env` e reiniciar o Nuxt.
2. Confirmar `NUXT_N8N_AGENTE_API_KEY` igual no N8N e no app.
3. No workflow piloto, desconectar `agente4` e apontar HTTP Request para o endpoint.
4. Testar: mensagem simples → `reply_text`; pergunta de produto → tool `estoque` nos logs do N8N; histórico na mesma `conversa_key`.
