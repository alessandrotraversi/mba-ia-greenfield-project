# 🎬 Brainstorm — ADR da Fase 03: Upload e Processamento de Vídeos

**Objetivo:** Pensar em voz alta sobre as principais decisões técnicas (TD-01 a TD-07) que vão estruturar a Fase 03.

**Status:** 💭 Brainstorm (será convertido em technical-decisions-phase-03-videos.md)

---

## 📋 TDs Esperadas (Ordem de Criticidade)

### **TD-01: Tecnologia de Fila** 🔴 CRÍTICA

**Capability:** Processamento automático do vídeo após upload (pré-cadastro automático do vídeo como rascunho ao iniciar o upload → processamento em segundo plano → extração de duração/metadados)

**Contexto:** 
- O upload de 10GB não pode bloquear a API
- Após upload → precisamos processar (FFmpeg) de forma assíncrona
- A arquitetura já prevê "Message Queue (TBD)"
- Precisa suportar múltiplos workers consumindo a mesma fila
- Precisa ser testável no Docker Compose

**Opções em Análise:**

**A. Redis + Bull**
- Bull = abstraçãonestJS-friendly sobre Redis
- Pros: Simples, leve, testes reais fáceis (Redis em container), integração Bull + NestJS via @nestjs/bull
- Cons: Redis pode não escalar para milhões de jobs (vs. RabbitMQ), sem persistência entre restarts (mitigável com dump RDB)
- **Tendência:** 🟢 FAVORITA — prototipagem rápida, testes reais, escalabilidade moderada (ok para MVP)

**B. RabbitMQ**
- Full-fledged message broker, Enterprise-grade
- Pros: Escalável, routing avançado, persistência robusta, redelivery guarantees
- Cons: Overhead complexo para fase MVP, overhead Docker, configuração RabbitMQ + NestJS adapter (@nestjs/bull NÃO funciona direto com RabbitMQ, precisa @golevelup/nestjs-rabbitmq)
- **Tendência:** 🟡 OVERENGINEERED — salvar para Fase 04+ se volume crescer

**C. AWS SQS**
- Managed service, sem operação local
- Pros: Production-ready, autoscaling automático
- Cons: Não testável localmente sem mock, dependência de AWS credentials em dev, custo
- **Tendência:** 🔴 DESCARTADA — desenvolvimento local fica pior

**Recomendação Preliminar:** **Redis + Bull**
- Razão: Simplicidade, testes com Docker real, escalabilidade aceitável, integração NestJS native

---

### **TD-02: Estratégia de Upload 10GB** 🔴 CRÍTICA

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Contexto:**
- Se passarmos o arquivo inteiro de 10GB através da API (bodyParser), vai trawar a memória + API
- Precisamos de uma estratégia que não bloqueia a API
- MinIO (S3-compatible) vai estar disponível no Docker
- O browser do frontend não consegue enviar 10GB direto (timeout de rede, etc)

**Opções em Análise:**

**A. Upload Pré-Assinado (URL Presigned)**
- API gera uma URL pré-assinada do S3/MinIO com permissão limitada (ex: 30min)
- Browser envia o arquivo diretamente para MinIO usando essa URL
- API recebe apenas um callback (webhoo ou polling) quando upload termina
- Pros: Não passa 10GB pela API, escalável, padrão AWS, simples testar
- Cons: Implementar presigned URL no MinIO, exige callback/webhook ou polling na API
- **Tendência:** 🟢 FAVORITA

**B. Multipart Upload via API**
- Frontend divide o arquivo em chunks (ex: 10MB cada)
- Envia chunks sequencialmente para a API
- API agrega os chunks e envia para MinIO
- Pros: Controle total na API, fácil rastrear progresso, reintentar chunks perdidos
- Cons: API ainda processa 10GB (mas em chunks), consome RAM, mais complexo
- **Tendência:** 🟡 ALTERNATIVA (se presigned não funcionar bem)

**C. Direct Streaming para MinIO**
- Frontend abre um stream HTTP para a API
- API faz pipe direto para MinIO (sem buffering)
- Pros: Nenhuma cópia em memória
- Cons: Confiabilidade de rede, implementação complexa, pouca documentação em NestJS
- **Tendência:** 🟡 FUTURO (se B ficar complexo)

**Recomendação Preliminar:** **A (URL Pré-Assinada)**
- Razão: Padrão industry, não trava a API, testável com MinIO local

---

### **TD-03: Worker de Vídeo (Infraestrutura)** 🔴 CRÍTICA

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados, geração automática de thumbnail)

**Contexto:**
- FFmpeg precisa rodar em algum lugar
- Pode ser no mesmo processo da API ou em um worker separado
- Precisa consumir jobs da fila
- Precisa ler do MinIO, escrever de volta pro MinIO, atualizar DB

**Opções em Análise:**

**A. Worker em Container Separado (recomendado)**
- Dockerfile.worker com FFmpeg + Node + @nestjs/bull consumer
- Docker Compose: serviço `worker` separado (pode rodar múltiplas instâncias)
- Comunica via fila (Redis) + DB (PostgreSQL)
- Pros: Isolamento, escalável (N workers), a API não carrega FFmpeg, resiliência (worker cai != API cai)
- Cons: Mais complexidade no Docker Compose, logging distribuído, debugging mais complexo
- **Tendência:** 🟢 FAVORITA

**B. Worker no Mesmo Processo da API**
- Usar @nestjs/bull para criar um consumer no mesmo processo NestJS
- Pros: Deploy simples, logging centralizado, debugging local fácil
- Cons: API concorre por CPU com FFmpeg (pode travar requisições), não escalável
- **Tendência:** 🟡 PROTOTIPAGEM (depois migrar para A)

**Recomendação Preliminar:** **A (Container Separado)**
- Razão: Isolamento, escalabilidade, padrão production

---

### **TD-04: Estratégia de Streaming** 🟡 ALTA

**Capability:** Reprodução via streaming (sem necessidade de download completo)

**Contexto:**
- Como servir o vídeo no GET /videos/:id/stream?
- Precisa suportar "seek" (ir para 30min do vídeo sem baixar tudo antes)
- Precisa suportar players HTML5 padrão

**Opções em Análise:**

**A. HTTP Range Requests (206 Partial Content)**
- GET /videos/:id/stream com header `Range: bytes=0-1024`
- API responde com 206 Partial Content + os bytes solicitados
- Browser/player automaticamente faz múltiplos Range requests
- Pros: Simples, suportado por todos os browsers/players, funciona com qualquer arquivo
- Cons: Muitas pequenas requisições, pouca compressão
- **Tendência:** 🟢 MVP (comece aqui)

**B. HLS (HTTP Live Streaming)**
- Transcodificar vídeo em múltiplas qualidades + resoluções
- Gerar manifesto M3U8 + segmentos .ts
- Browser/player baixa manifesto, depois segmentos conforme conexão
- Pros: Adaptive bitrate, otimizado para streaming, usado por Netflix/YouTube
- Cons: Requires transcoding (muito CPU), complexo, overkill para MVP
- **Tendência:** 🔴 FUTURO (Fase 04+)

**C. Streaming Progressivo (simples)**
- GET /videos/:id/stream retorna o arquivo inteiro
- Browser começa a reproduzir enquanto recebe
- Pros: Super simples de implementar
- Cons: Sem seek (deve assistir do início), não ideal para vídeos longos
- **Tendência:** 🔴 DESCARTADA

**Recomendação Preliminar:** **A (Range Requests)**
- Razão: Simples, funciona em MVP, fácil migrar para HLS depois

---

### **TD-05: Identificador Único do Vídeo (URL)** 🟡 ALTA

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Contexto:**
- O vídeo precisa de um identificador que seja URL-safe
- Pode ser UUID, slug customizável, hash, etc.
- Afeta a URL da reprodução: `/videos/{id}/stream` ou `/videos/{slug}/stream`?

**Opções em Análise:**

**A. UUID v4 (simples, único)**
- Gerar UUID v4 na migration/criação
- URL: `/videos/550e8400-e29b-41d4-a716-446655440000/stream`
- Pros: Garantido único (RFC), sem conflito, rápido gerar, sem lógica de geração
- Cons: URL longan (36 chars), não legível
- **Tendência:** 🟢 MVP (comece aqui)

**B. Slug Customizável**
- Usuário define slug (ex: "como-fazer-pizza")
- URL: `/videos/como-fazer-pizza/stream`
- Precisa validar unicidade por canal
- Pros: Legível, SEO-friendly
- Cons: Lógica de validação, colisões (precisa suffix numérico tipo YouTube)
- **Tendência:** 🟡 FUTURO (Fase 04 com edição de vídeo)

**C. Hash Curtido (nanoid, shortid)**
- Gerar ID curto (ex: "abc123def")
- Pros: Curto, único, pseudo-anônimo
- Cons: Menos standard, biblioteca extra (nanoid)
- **Tendência:** 🟡 ALTERNATIVA

**Recomendação Preliminar:** **A (UUID v4)**
- Razão: Garantia de unicidade, padrão SQL, MVP simples

---

### **TD-06: Ciclo de Status do Vídeo** 🟡 ALTA

**Capability:** Visualizar o status do processamento, tratamento de erros

**Contexto:**
- Um vídeo passa por estados diferentes após upload
- Precisamos saber se está pronto para reprodução ou ainda processando
- O que acontece em caso de erro (thumbnail não gerado, FFmpeg falhou)?

**Opções em Análise:**

**A. State Machine Simples (4 estados)**
```
draft       → criado após upload iniciado
  ↓
processing  → job enfileirado/executando
  ↓
ready       → processamento OK, pronto para reproduzir
  ↓ (erro)
error       → processamento falhou, tenta novamente
```
- Pros: Simples, cobre os casos principais, testável
- Cons: Sem retry automático (manual), sem tracking de tentativas
- **Tendência:** 🟢 MVP

**B. State Machine com Retry**
```
draft → processing → ready / error → retry → ready / error
```
- Adiciona lógica de retry automático (ex: 3 tentativas)
- Precisa de campos: `processing_attempts`, `last_error`, `next_retry_at`
- Pros: Resiliente, recupera de falhas transitórias
- Cons: Mais complexo, precisa de job scheduled (cron) para reprocessar
- **Tendência:** 🟡 FUTURO (Fase 04)

**C. Workflow Granular (mais estados)**
```
draft → upload_pending → uploaded → processing → thumbnail → metadata → ready / error
```
- Cada etapa é um estado
- Pros: Tracking fino, debugging fácil
- Cons: Muito overhead para MVP, não agrega muito value
- **Tendência:** 🔴 DESCARTADA

**Recomendação Preliminar:** **A (4 estados simples)**
- Razão: MVP simples, cobre os casos, fácil expandir depois

---

### **TD-07: Organização de Storage (MinIO)** 🟢 MÉDIA

**Capability:** Armazenar vídeos e thumbnails de forma organizada

**Contexto:**
- MinIO vai ter buckets (similar a S3)
- Como organizar dentro do bucket? Por canal? Por vídeo? Flat?
- Onde ficar videos vs thumbnails?

**Opções em Análise:**

**A. Por Canal (estrutura hierárquica)**
```
bucket: streamtube-videos
  ├─ channels/{channel_id}/
  │   ├─ videos/{video_id}.mp4
  │   └─ thumbnails/{video_id}.jpg
```
- Pros: Organizado, fácil listar vídeos de um canal, quotas por canal
- Cons: Um pouco mais complexo, keys mais longas
- **Tendência:** 🟢 FAVORITA

**B. Por Tipo (flat)**
```
bucket: streamtube-videos
bucket: streamtube-thumbnails
  ├─ {channel_id}-{video_id}.jpg
```
- Pros: Simples, fácil backup separado
- Cons: Menos organizado, listings lentos em escala
- **Tendência:** 🟡 ALTERNATIVA

**C. Flat em um único bucket**
```
bucket: streamtube
  ├─ videos/{video_id}.mp4
  ├─ thumbnails/{video_id}.jpg
```
- Pros: Super simples, sem buckets extras
- Cons: Tudo junto, difícil quota por canal
- **Tendência:** 🟡 FUTURO

**Recomendação Preliminar:** **A (Por Canal)**
- Razão: Escalável, organizado, prepara para quotas por channel

---

## 🎯 Recomendações Resumidas (Para a ADR)

| TD | Decisão | Razão |
|----|---------|----|
| **TD-01** | Redis + Bull | Simples, testes reais, escalável para MVP |
| **TD-02** | URL Pré-Assinada | Não trava API, padrão AWS, testável |
| **TD-03** | Worker em Container | Isolamento, escalável, production-ready |
| **TD-04** | Range Requests (206) | Simples, suportado, fácil migrar para HLS |
| **TD-05** | UUID v4 | Único garantido, padrão SQL, MVP |
| **TD-06** | 4 Estados Simples | MVP funcional, fácil expandir |
| **TD-07** | Por Canal (hierárquico) | Organizado, escalável, quotas |

---

## 💡 Decisões Não-Obvias / Polêmicas

### 1. **Por que Redis + Bull e não RabbitMQ?**
   - MVP precisa ser rápido de implementar e testar
   - Redis é simples no Docker (imagem alpine, ~10MB)
   - RabbitMQ é full-featured mas overkill para Fase 03
   - Se volume crescer (Fase 04+), migra para RabbitMQ
   - **Diferença:** Bull = Redis wrapper (prototipagem), RabbitMQ = enterprise (production scale)

### 2. **Por que URL Pré-Assinada e não Multipart?**
   - 10GB em chunks ainda consome RAM da API
   - Pré-assinada = zero carga na API, pura rede MinIO ← browser
   - Presigned URL é o padrão de toda a indústria (AWS, Google Cloud)
   - Exige implementação em MinIO SDK, mas vale a pena
   - **Diferença:** Presigned = client → MinIO direto, Multipart = client → API → MinIO

### 3. **Por que Worker Separado e não no mesmo processo?**
   - FFmpeg é CPU-intensive (transcodificar vídeo trava threads)
   - Se rodar na API, um upload congelaria toda a aplicação
   - Worker separado = API fica responsiva, worker cai independently
   - Escalar = aumentar replicas do worker, não precisa escalar API
   - **Diferença:** Acoplamento (same process) vs Isolamento (container)

### 4. **Por que UUID e não slug?**
   - Slug é legível mas precisa validar unicidade por canal (+ complexidade)
   - YouTube usa slugs, mas esse é um MVP, não precisa de SEO agora
   - UUID é garantido único, sem lógica extra
   - Fase 04 (edição de vídeo) pode adicionar slug em paralelo
   - **Diferença:** Complexidade agora vs Deixar para depois

---

## ⚠️ Trade-offs e Riscos

### Risco: Redis sem persistência
- **Impacto:** Se Redis cair, jobs perdidos
- **Mitigação:** Ativar RDB dump (padrão), ou migrar para RabbitMQ em Fase 04
- **Probabilidade:** Baixa em dev, aceitável para MVP

### Risco: Presigned URL expiração
- **Impacto:** Upload de 10GB pode tomar > 30min, URL expira
- **Mitigação:** Configurar presigned URL com TTL longo (ex: 2h), ou implementar refresh
- **Probabilidade:** Média (upload lento em conexões ruins)

### Risco: FFmpeg em container não funciona como esperado
- **Impacto:** Thumbnail ou duração não gerada
- **Mitigação:** Testar FFmpeg em container durante implementação, ter fallback (thumbnail placeholder)
- **Probabilidade:** Baixa (FFmpeg é maduro), Medium (com binding Node.js)

### Risco: UUID não é humano-legível (UX)
- **Impacto:** URLs feias (ex: /videos/550e8400-e29b-41d4-a716-446655440000/stream)
- **Mitigação:** Fase 04 adiciona slug, ou criar "short link" com hash
- **Probabilidade:** Alta, mas aceitável para MVP

---

## 📝 Próximos Passos

1. **Validar com Claude (IA):** Rodar `/research` com essas opções, validar trade-offs
2. **Consultar context7:** Verificar versões atuais (Bull, MinIO SDK, FFmpeg bindings, NestJS integrations)
3. **Escrever technical-decisions-phase-03-videos.md:** Converter esse brainstorm em formato ADR
4. **Atualizar PLANO_ACAO_FASE_03.md:** Incorporar as decisões no contexto

---

**Criado por:** Alessandro + Claude (brainstorm)  
**Data:** 2026-07-31  
**Status:** 💭 Análise (próximo: research skill)
