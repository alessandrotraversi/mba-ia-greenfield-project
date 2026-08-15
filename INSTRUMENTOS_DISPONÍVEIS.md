# 🔧 Instrumentos e Ferramentas Disponíveis — Fase 03

**Documento:** Referência de ferramentas, skills e recursos para desenvolvimento da Fase 03  
**Projeto:** StreamTube (mba-ia-greenfield-project)  
**Atualizado:** 2026-07-31

---

## 🤖 IA — Claude Code + Skills

### **Skills de Desenvolvimento Disponíveis**

Todas as skills estão em `.claude/skills/` e funcionam com `/comando`:

#### **1. `/research` — Pesquisar Opções e Decidir**
**Fase:** 01 — Research  
**Entrada:** Decisão em aberto (ex.: "fila para processamento de vídeos")  
**Saída:** Análise de opções com trade-offs e recomendação  
**Artefato Gerado:** `docs/decisions/technical-decisions-phase-03-videos.md`

**Como usar:**
```
/research "Qual fila usar para processamento de vídeos em larga escala? 
Opções: Redis (Bull), RabbitMQ, AWS SQS. 
Contexto: NestJS, Docker, processamento de até 10GB de vídeo."
```

**Saída esperada:**
- Comparação de opções (performance, overhead, integração)
- Trade-offs (custo, complexidade, escalabilidade)
- Recomendação com justificativa

---

#### **2. `/plan-context` — Consolidar Contexto da Fase**
**Fase:** 02 — Planning  
**Entrada:** Decisões técnicas + requisitos do project-plan.md  
**Saída:** Contexto estruturado (dependências, escopo, constraints)  
**Artefato Gerado:** `docs/phases/phase-03-videos/context.md`

**Como usar:**
```
/plan-context "Fase 03: Upload e Processamento de Vídeos.
Decisões técnicas já em docs/decisions/technical-decisions-phase-03-videos.md.
Consolidar contexto, dependências e pré-requisitos."
```

---

#### **3. `/plan-validate` — Validar Inconsistências e Gaps**
**Fase:** 02 — Planning  
**Entrada:** context.md  
**Saída:** Validação (status: CLEAN ou DIRTY + lista de pendências)  
**Artefato Gerado:** `docs/phases/phase-03-videos/validation.md`

**Como usar:**
```
/plan-validate "Validar context.md da Fase 03.
Checklist: decisões completas? Libs confirmadas? Dependências mapeadas?"
```

**O que esperar:**
- Se CLEAN: pode passar para plan-build
- Se DIRTY: volte ao plan-resolve (fixar pendências)

---

#### **4. `/plan-resolve` — Fixar Libs e Completar Decisões**
**Fase:** 02 — Planning  
**Entrada:** validation.md (status DIRTY) + pendências  
**Saída:** library-refs.md (libs confirmadas com versões) + contexto atualizado  
**Artefato Gerado:** `docs/phases/phase-03-videos/library-refs.md`

**Como usar:**
```
/plan-resolve "Pendências da Fase 03:
- Confirmar versão de Bull queue
- Validar FFmpeg bindings (node-ffmpeg vs ffmpeg.js)
- Definir SDK S3 para MinIO
Use context7 para consultar docs oficiais."
```

**Responsabilidades:**
- Consultar context7 para versões atuais
- Validar compatibilidade entre libs
- Atualizar context.md com novas informações

---

#### **5. `/plan-build` — Gerar o Plano Executável**
**Fase:** 02 — Planning  
**Entrada:** validation.md (status CLEAN) + context.md + decisões  
**Saída:** Plano detalhado com SIs, Technical Specs, Dependency Map  
**Artefato Gerado:** `docs/phases/phase-03-videos/phase-03-videos.md`

**Como usar:**
```
/plan-build "Gerar plano da Fase 03.
Entrada: context.md (CLEAN), decisões técnicas, library-refs.md.
Saída: SIs (SI-03.1 a SI-03.x) + Data Model + API Contracts + 
       Authorization Matrix + Error Catalog + Events/Messages (fila) + 
       Dependency Map + Deliverables."
```

**Formato esperado (referência: docs/phases/phase-02-auth/phase-02-auth.md):**
```
# Plano da Fase 03: Upload e Processamento de Vídeos

## Step Implementations

### SI-03.1: Setup Infraestrutura
- Configurar compose.yaml (MinIO, fila, worker)
- Testes: Docker services healthy
- Deliverable: compose.yaml + docker-compose up -d funcionando

### SI-03.2: Entidade e Migration
- Criar entity Video (ligada ao channel)
- Migration CreateVideos
- Testes: schema criado, entidade hibernates
- Deliverable: video.entity.ts + migration

... (mais SIs)

## Technical Specifications

### Data Model
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  channel_id UUID NOT NULL,
  title VARCHAR,
  status VARCHAR ('draft', 'processing', 'ready', 'error'),
  storage_key VARCHAR,
  thumbnail_key VARCHAR,
  duration INT,
  metadata JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
```

### API Contracts
- POST /videos/upload — inicia upload, retorna vídeo em draft
- GET /videos/:id/stream — streaming com range requests
- ...

### Authorization Matrix
- POST /videos/upload: autenticado
- GET /videos/:id: público (se vídeo ready), autenticado se draft
- ...

### Error Catalog
- UPLOAD_TOO_LARGE: arquivo > 10GB
- PROCESSING_FAILED: FFmpeg error
- ...

### Events/Messages (Fila)
- video.upload.completed → consumer: processa
- video.processing.done → DB: atualiza status
- ...

## Dependency Map
API → VideosService
VideosService → VideosRepository
VideosService → QueueService
QueueService → Redis (via Bull)
Worker → VideoWorker (consumer)
VideoWorker → FFmpeg

## Deliverables
- docker-compose.yaml atualizado
- Video entity + migration
- VideosModule (controller, service, repository)
- QueueService + worker
- Testes unit + integração + e2e
```

---

#### **6. `/implement` — Implementar SI por SI**
**Fase:** 03 — Implementation  
**Entrada:** Plano (phase-03-videos.md)  
**Saída:** Código + testes + progress.md  
**Artefato Atualizado:** `docs/phases/phase-03-videos/progress.md`

**Como usar:**
```
/implement "Fase 03, SI-03.3: Upload — API endpoint + pré-cadastro.
Especificação: Implementar POST /videos/upload, 
retornar vídeo em status 'draft', não processar ainda.
Testes esperados: controller.spec.ts, service.spec.ts, 
repository.integration-spec.ts, e2e.spec.ts."
```

**Ciclo:**
1. Implementar código (controller, service, repository)
2. Escrever testes (unit, integração, e2e)
3. Rodar `npm test` — deve passar 100%
4. Atualizar `progress.md` com status SI
5. Passar ao SI seguinte

---

#### **7. `/verify` — Validar Definition of Done**
**Fase:** 04 — Validation  
**Entrada:** Branch com código implementado  
**Saída:** Resultado de testes + tsc + lint  
**Artefato:** Feedback de validação

**Como usar:**
```
/verify "Validar Definition of Done da Fase 03:
- npm test (unit + integração)
- npm run test:e2e
- npx tsc --noEmit
- npm run lint
Todos devem passar com exit code 0."
```

---

### **Sub-agents Especializados (Usados internamente pelas skills)**

Não invocados diretamente pelo usuário; usados pelas skills:

| Agent | Uso | Interno |
|-------|-----|---------|
| `adr-analyzer` | Gerar Architecture Decision Records | `/research` |
| `explorer` | Explorar codebase (encontrar padrões) | `/plan-context` |
| `plan-reader` | Ler project-plan.md | `/plan-context` |
| `decisions-reader` | Ler documentos de decisões | `/plan-validate` |

---

## 🌐 MCP Servers (Context Protocol Servers)

Configurados em `.mcp.json` e acessíveis via skills:

### **1. `context7` — Consultar Documentação Oficial**
**Endpoint:** npm packages, GitHub repos, online docs  
**Uso na Fase 03:** Confirmar versões de libs antes de usar

**Exemplos:**
```
/research "context7: Bull queue npm package latest version and API docs"
→ Retorna: versão, exports, métodos, exemplos de uso

/plan-resolve "context7: ffmpeg npm bindings, compareFFmpeg.js vs node-ffmpeg"
→ Retorna: diferenças, performance, como integrar no NestJS

/plan-resolve "context7: AWS SDK S3 compatibility with MinIO"
→ Retorna: métodos suportados, configuração de endpoint, exemplos
```

**Libs esperadas de consultar na Fase 03:**
- `bull` (fila de trabalhos)
- `@aws-sdk/client-s3` (ou `aws-sdk` v3 — MinIO compatibility)
- `fluent-ffmpeg` ou `@ffmpeg/ffmpeg` (processamento de vídeo)
- `@nestjs/bull` (integração Bull com NestJS)

---

### **2. `postgres` — Executar Queries no DB Real**
**Endpoint:** PostgreSQL 17 container (nestjs-project/compose.yaml)  
**Uso na Fase 03:** Testar migration, verificar schema, validar dados

**Exemplos:**
```
/plan-validate "postgres: SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'videos'"
→ Verifica se migration rodou

/implement "postgres: Consultar estrutura de videos após migration
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'videos'"
→ Valida schema criado
```

**Quando usar:**
- Após cada migration (verificar schema)
- Validar relacionamento com `channels` (foreign key)
- Testar dados inseridos pelos testes

---

### **3. `webstorm` — IDE Integration (Opcional)**
**Apenas se usar WebStorm/IntelliJ**  
**Uso:** Análise de código, refactoring, lint automatizado

---

## 📦 Dependências de Projeto (Esperadas)

### **Backend — nestjs-project/package.json**

Libs de desenvolvimento já instaladas (Fases 01–02):

```json
{
  "dependencies": {
    "@nestjs/common": "^11.x",
    "@nestjs/core": "^11.x",
    "@nestjs/jwt": "^12.x",
    "@nestjs/config": "^3.x",
    "@nestjs/typeorm": "^10.x",
    "typeorm": "^0.3.x",
    "postgresql": "17",
    "argon2": "^0.31.x",
    "class-validator": "^0.14.x"
  }
}
```

**Libs novas esperadas (Fase 03):**

| Lib | Versão | Propósito | Como Instalar |
|-----|--------|----------|----------------|
| `bull` | ^4.x ou ^5.x | Fila de trabalhos | `npm install bull` |
| `@nestjs/bull` | ^10.x | Integração Bull + NestJS | `npm install @nestjs/bull bull` |
| `redis` | ^4.x | Cliente Redis (dependência de Bull) | Auto (via bull) |
| `@aws-sdk/client-s3` | ^3.x | S3 SDK (MinIO compatibility) | `npm install @aws-sdk/client-s3` |
| `fluent-ffmpeg` | ^2.1.x | Processamento de vídeo | `npm install fluent-ffmpeg` |
| `@types/fluent-ffmpeg` | ^2.1.x | Types para TS | `npm install -D @types/fluent-ffmpeg` |

**Instalação (após plan-resolve):**
```bash
cd nestjs-project
npm install bull @nestjs/bull @aws-sdk/client-s3 fluent-ffmpeg
npm install -D @types/fluent-ffmpeg
npm install  # re-instala com lock atualizado
```

---

## 🐳 Docker Compose — Infraestrutura

### **Atual (após Fases 01–02)**

```yaml
# nestjs-project/compose.yaml
services:
  nestjs-api:
    build: .
    ports: [3000:3000]
    depends_on:
      - db
      - mailpit
    
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: streamtube
      POSTGRES_PASSWORD: streamtube
      POSTGRES_DB: streamtube
    ports: [5432:5432]
    
  mailpit:
    image: axllent/mailpit
    ports: [1025:1025, 8025:8025]
```

### **Novo (esperado após SI-03.1)**

```yaml
services:
  nestjs-api:
    # ... (mesmo de antes)
    depends_on:
      - db
      - mailpit
      - minio       # ← novo
      - redis       # ← novo
      - worker      # ← novo
    
  db:
    # ... (mesmo de antes)
    
  mailpit:
    # ... (mesmo de antes)
    
  minio:              # ← novo: Object Storage (S3-compatible)
    image: minio/minio:latest
    ports: [9000:9000, 9001:9001]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    
  redis:              # ← novo: Fila (Bull backend)
    image: redis:7-alpine
    ports: [6379:6379]
    
  worker:             # ← novo: Video Worker (FFmpeg + consumer)
    build:
      context: .
      dockerfile: Dockerfile.worker
    depends_on:
      - db
      - redis
      - minio
    environment:
      DB_HOST: db      # (nota: não localhost!)
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
```

**Validação após setup:**
```bash
docker compose up -d
docker compose ps
# Saída esperada: 6 services, todos "Up" ou "healthy"

docker compose logs -f
# Verificar se há erros críticos

docker compose down  # parar tudo
```

---

## 🧪 Testes — Estrutura e Convenção

### **Tipos de Testes Esperados**

| Tipo | Suffix | Localização | Quando Escrever |
|------|--------|-------------|-----------------|
| **Unit** | `.spec.ts` | Próximo ao arquivo testado | Lógica pura (service, utils) |
| **Integração** | `.integration-spec.ts` | Próximo ao arquivo | Com DB, repositories, serviços reais |
| **E2E** | `.e2e-spec.ts` | `test/` na raiz | HTTP cycle completo (supertest) |

### **Exemplo: Testando SI-03.3 (Upload)**

```typescript
// src/videos/videos.controller.spec.ts (UNIT)
describe('VideosController', () => {
  it('should accept upload start and return draft video', async () => {
    // Mock: VideoService, ChannelService
    const mockVideoService = {
      createDraft: jest.fn().mockResolvedValue({
        id: 'uuid',
        status: 'draft',
        channelId: 'channel-uuid'
      })
    };
    
    // Test
    const result = await controller.startUpload({
      channelId: 'channel-uuid',
      filename: 'test.mp4',
      size: 1000
    });
    
    expect(result.status).toBe('draft');
    expect(mockVideoService.createDraft).toHaveBeenCalled();
  });
});

// src/videos/videos.service.integration-spec.ts (INTEGRAÇÃO)
describe('VideoService — integração com DB', () => {
  it('should persist video as draft with all fields', async () => {
    // Real DB via Docker
    const channel = await channelRepo.save({ /* ... */ });
    
    const video = await videoService.createDraft(channel.id, 'test.mp4');
    
    // Assert: verificar banco real
    const saved = await videoRepo.findOne(video.id);
    expect(saved.status).toBe('draft');
    expect(saved.channelId).toBe(channel.id);
  });
});

// test/videos.e2e-spec.ts (E2E)
describe('Videos E2E', () => {
  it('POST /videos/upload should start upload and return draft', async () => {
    const user = await createTestUser();
    const channel = user.channel;
    
    const response = await request(app.getHttpServer())
      .post('/videos/upload')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ filename: 'test.mp4', size: 1000 });
    
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
  });
});
```

### **Rodar Testes**

```bash
# Apenas unit + integração
npm test

# Watch mode (durante desenvolvimento)
npm run test:watch -- src/videos

# Com cobertura
npm run test:cov

# E2E (requer app rodando)
npm run test:e2e

# Lint
npm run lint

# Type-check
npx tsc --noEmit
```

---

## 📚 Documentação de Referência

Arquivos do projeto para consultar:

| Arquivo | Conteúdo | Relevância |
|---------|----------|-----------|
| `docs/project-plan.md` | **Requisitos completos da Fase 03** | 🔴 CRÍTICO — consultar antes de começar |
| `CLAUDE.md` (raiz) | Regras globais do projeto | 🟡 Importante — respeitar Git Flow, Definition of Done |
| `nestjs-project/CLAUDE.md` | Regras NestJS específicas | 🟡 Importante — controllers, services, migrations, tests |
| `docs/phases/phase-02-auth/` | Estrutura e formato da fase | 🟡 Usar como referência visual |
| `docs/diagrams/software-arch.mermaid` | Arquitetura C4 (mostra storage, fila, worker) | 🟡 Entender posição de cada componente |
| `.mcp.json` | Configuração de MCP servers | 🟢 Validar context7, postgres habilitados |
| `.claude/skills/` | Skills disponíveis | 🟢 Invocar com `/skill-name` |

---

## 💡 Dicas de Uso Prático

### **Workflow Recomendado**

1. **Lê o PLANO_ACAO_FASE_03.md** (este arquivo já criado)
2. **Invoca `/research`** → gera technical-decisions-phase-03-videos.md
3. **Invoca `/plan-context`** → gera context.md
4. **Invoca `/plan-validate`** → gera validation.md
   - Se DIRTY → `/plan-resolve` → volta a validate
   - Se CLEAN → continua
5. **Invoca `/plan-build`** → gera phase-03-videos.md (o plano)
6. **Invoca `/implement`** SI por SI, rodando testes a cada SI
7. **Invoca `/verify`** → valida Definition of Done
8. **Git push** → abre PR para `dev`

### **Quando Usar context7**

```
"Preciso saber a versão atual de Bull, como configurar com Redis,
e se é compatível com NestJS 11"

→ /research "context7: Bull library npm, NestJS integration, Redis backend"
```

### **Quando Usar postgres**

```
"Quero verificar se minha migration rodou corretamente e o schema está ok"

→ /plan-validate "postgres: Consultar schema da tabela 'videos'"
```

### **Quando Pedir Revisão de Código**

```
"Este VideoService segue o padrão do projeto? Falta alguma coisa?"

→ Claude revisa vs. padrão de auth/users (services + repositories)
```

---

## 🚨 Checklist Antes de Começar

- [ ] Backend rodando: `docker compose up -d`
- [ ] Testes passando: `npm test` (Fases 01–02)
- [ ] Você leu `docs/project-plan.md` (Fase 03)
- [ ] Você leu `docs/phases/phase-02-auth/` (referência de estrutura)
- [ ] `.mcp.json` configurado (context7, postgres)
- [ ] Branch `feature/phase-03-videos` criada e está ativa
- [ ] Este documento (`INSTRUMENTOS_DISPONÍVEIS.md`) aberto para referência rápida

---

**Criado por:** Claude Code  
**Projeto:** StreamTube Fase 03  
**Status:** Referência Ativa  
**Última atualização:** 2026-07-31
