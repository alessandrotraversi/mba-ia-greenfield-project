# 🎯 Resumo Executivo — Fase 03: Upload e Processamento de Vídeos

**Status:** 🟡 Pronto para Início  
**Data:** 2026-07-31  
**Duração Estimada:** 20-25 horas  
**Ferramenta Primária:** Claude Code (IA)

---

## ⚡ TL;DR (30 segundos)

A **Fase 03** adiciona upload de vídeos (até 10GB), processamento automático (duração, metadados, thumbnail), armazenamento e streaming ao StreamTube. É um desafio de engenharia com fila, worker, storage e testes reais.

**Próximo Passo:** Rodas `/research` para pesquisar opções de fila, estratégia de upload e processamento.

---

## 🎯 Objetivo da Fase

Entregar uma plataforma funcional de upload e reprodução de vídeos:

| Capacidade | Status |
|-----------|--------|
| Upload de até 10GB sem travar API | ✅ Entregar |
| Pré-cadastro automático como rascunho | ✅ Entregar |
| Processamento automático (duração + metadados + thumbnail) | ✅ Entregar |
| URL única por vídeo | ✅ Entregar |
| Streaming sem download completo | ✅ Entregar |
| Download do vídeo | ✅ Entregar |
| Ciclo de status (draft → processing → ready/error) | ✅ Entregar |

---

## 📊 Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   Usuario (Browser)                      │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  API NestJS (3000)                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  POST /videos/upload      (inicia upload)          │ │
│  │  GET  /videos/:id/stream  (reprodução)             │ │
│  │  GET  /videos/:id/download (download)              │ │
│  └────────────────────────────────────────────────────┘ │
└─────┬──────────────────┬──────────────────┬─────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ MinIO (S3)   │  │ Redis (Fila) │
│ (Vídeos DB)  │  │ (Storage)    │  │ (Bull)       │
└──────────────┘  └──────────────┘  └──────┬───────┘
                                           │ Consome
                                           ▼
                                    ┌──────────────────┐
                                    │ Worker (FFmpeg)  │
                                    │ - Extrai duração │
                                    │ - Gera thumbnail │
                                    │ - Atualiza DB    │
                                    └──────────────────┘
```

**Novos Componentes (Fase 03):**
- 🟦 MinIO (S3-compatible storage — local no Docker)
- 🟥 Redis + Bull (fila de trabalhos)
- 🟩 Worker (container separado — FFmpeg + NestJS consumer)

**Componentes Existentes (Fases 01–02):**
- API NestJS
- PostgreSQL 17
- Mailpit

---

## 📋 Itens Entregáveis

### **Documentação (4 artefatos na pasta `docs/phases/phase-03-videos/`)**

1. **context.md** — Consolidação do contexto (dependências, requisitos)
2. **validation.md** — Validação (status deve ser CLEAN antes de implementar)
3. **library-refs.md** — Libs novas confirmadas (Bull, S3 SDK, FFmpeg)
4. **phase-03-videos.md** — **Plano executável com:**
   - 7-10 Step Implementations (SI-03.1, SI-03.2, etc.)
   - Data Model (schema de vídeos)
   - API Contracts (endpoints)
   - Authorization Matrix (permissões)
   - Error Catalog (exceções)
   - Events/Messages (fila)
   - Dependency Map
   - Deliverables

5. **progress.md** — Progresso SI a SI (durante implementação)

6. **technical-decisions-phase-03-videos.md** — Decisões técnicas (research)

### **Código (Backend NestJS)**

```
nestjs-project/
├── src/videos/                      ← novo módulo
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── entities/
│   └── videos.module.ts
├── src/database/migrations/
│   └── *-CreateVideos.ts
├── compose.yaml                     ← atualizado (+ MinIO, Redis, Worker)
└── [worker de vídeo conforme plano]
```

### **Infraestrutura (Docker Compose)**

- MinIO (S3-compatible storage)
- Redis (fila via Bull)
- Video Worker (container separado com FFmpeg)

### **Testes (Qualidade)**

- Unit tests (`.spec.ts`) — lógica de serviços
- Integration tests (`.integration-spec.ts`) — com DB real
- E2E tests (`.e2e-spec.ts`) — ciclo HTTP completo

---

## 🛣️ Roadmap de Execução

### **Semana 1 — Planejamento (7h)**

```
T+0h:  /research "fila, upload, worker"
       ↓ (1–2h)
       technical-decisions-phase-03-videos.md

T+2h:  /plan-context "contexto da fase"
       ↓ (0.5h)
       context.md

T+2.5h: /plan-validate "revisar contexto"
       ↓ (0.5h)
       validation.md (DIRTY ou CLEAN?)

T+3h:  Se DIRTY:
       /plan-resolve "completar libs e decisões"
       → volta a validate

T+5h:  validation.md = CLEAN ✅

T+5h:  /plan-build "gerar plano executável"
       ↓ (1–2h)
       phase-03-videos.md com SIs

T+7h:  ✅ PLANEJAMENTO PRONTO
```

### **Semana 2 — Implementação (12–15h)**

```
T+7h:   /implement "SI-03.1: Setup infraestrutura"
        → docker compose atualizado, testes verdes
        ↓ (1.5h)

T+8.5h: /implement "SI-03.2: Entidade + Migration"
        → entity, migration, testes
        ↓ (1.5h)

T+10h:  /implement "SI-03.3: Upload endpoint"
        → controller, service, pré-cadastro
        ↓ (2h)

T+12h:  /implement "SI-03.4: Fila e Worker"
        → QueueService, worker setup
        ↓ (2h)

T+14h:  /implement "SI-03.5: Processamento (FFmpeg)"
        → extração de duração, thumbnail
        ↓ (2h)

T+16h:  /implement "SI-03.6: Streaming e Download"
        → GET endpoints com range requests
        ↓ (2h)

T+18h:  /implement "SI-03.7: Testes finais"
        → coverage, edge cases
        ↓ (1h)

T+19h:  ✅ IMPLEMENTAÇÃO PRONTA
```

### **Semana 3 — Validação (2h)**

```
T+19h:  /verify "Definition of Done"
        ↓ (1h)
        npm test ✅
        npx tsc --noEmit ✅
        npm run lint ✅

T+20h:  Documentação atualizada
        CLAUDE.md com seção de vídeos

T+21h:  ✅ GIT E ENTREGA
        git push → PR para dev
```

---

## 🔑 Decisões Técnicas Abertas

Serão pesquisadas e fechadas em `ETAPA 01 (RESEARCH)`:

| Decisão | Opções | Trade-off Chave |
|---------|--------|-----------------|
| **Fila** | Redis (Bull), RabbitMQ, AWS SQS | Simplicidade vs. Escalabilidade |
| **Upload 10GB** | Pré-assinada (S3), multipart, streaming | Performance vs. Complexidade |
| **Worker** | Container separado, mesmo processo | Isolamento vs. Overhead |
| **Streaming** | Range requests (206), HLS | Compatibilidade vs. Eficiência |
| **URL Única** | UUID, slug, hash | Segurança vs. Usabilidade |

Nenhuma dessas está resolvida por decreto — você pesquisa, justifica e escolhe.

---

## 📊 Métricas de Sucesso

Ao final, o projeto deve:

| Métrica | Alvo | Status |
|---------|------|--------|
| Testes passando | 100% (unit + integração + e2e) | ⏳ |
| Type-check (tsc) | exit code 0 | ⏳ |
| Lint | sem erros | ⏳ |
| Docker services | todos healthy | ⏳ |
| Upload 10GB | sem travar API | ⏳ |
| Processamento automático | com Worker rodando | ⏳ |
| Streaming funcional | 206 Partial Content | ⏳ |
| Ciclo de status | draft → processing → ready | ⏳ |
| Artefatos de planejamento | 5 docs em docs/phases/phase-03-videos/ | ⏳ |

---

## 🎯 Próximos Passos (Imediatos)

1. **Lê este resumo** ✅ (você está aqui)
2. **Abre PLANO_ACAO_FASE_03.md** — referência detalhada
3. **Abre INSTRUMENTOS_DISPONÍVEIS.md** — skills e tools
4. **Cria branch:** `git checkout -b feature/phase-03-videos origin/dev`
5. **Começa research:** `/research "Decisões da Fase 03..."`

---

## 📚 Referências Rápidas

| Documento | Propósito |
|-----------|-----------|
| `PLANO_ACAO_FASE_03.md` | Plano detalhado (5 etapas) |
| `INSTRUMENTOS_DISPONÍVEIS.md` | Skills, MCP servers, testes |
| `docs/project-plan.md` | Requisitos oficiais da Fase 03 |
| `docs/phases/phase-02-auth/` | Formato de referência (usar como modelo) |
| `nestjs-project/CLAUDE.md` | Regras NestJS do projeto |

---

## ⚠️ Regras Críticas

1. **Validação deve fechar em CLEAN** antes de implementar
2. **Não mocke a fila/storage** — rodar real no Docker
3. **Uploads via URL pré-assinada**, não passar 10GB pela API
4. **Git Flow:** trabalho em `feature/*` a partir de `dev`, nunca commit na `main`
5. **Definition of Done:** testes + tsc + lint + Docker healthy

---

## 🤝 Suporte

- **Dúvidas sobre skills?** Consulte `INSTRUMENTOS_DISPONÍVEIS.md`
- **Dúvidas sobre timeline?** Consulte `PLANO_ACAO_FASE_03.md`
- **Dúvidas sobre requisitos?** Consulte `docs/project-plan.md`
- **Dúvidas sobre código?** Consulte `nestjs-project/CLAUDE.md`

---

**Criado por:** Claude Code  
**Data:** 2026-07-31  
**Status:** 🟢 Pronto para Iniciar  
**Tempo Estimado:** 20–25 horas  
**Deadline:** Conforme agendado
