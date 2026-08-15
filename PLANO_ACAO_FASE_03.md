# 🎬 Plano de Ação — Fase 03: Upload e Processamento de Vídeos

**Data:** 2026-07-31  
**Projeto:** StreamTube (mba-ia-greenfield-project)  
**Fase:** 03 — Upload e Processamento de Vídeos  
**Status:** 🟡 Planejamento Inicial

---

## 📋 Visão Geral

Este plano detalha a implementação completa da **Fase 03** do StreamTube, seguindo o workflow de desenvolvimento orientado por IA do projeto. A fase abrange:

- ✅ Upload de vídeos até 10GB sem travar a API
- ✅ Processamento automático em fila (duração, metadados, thumbnail)
- ✅ URL única por vídeo com streaming
- ✅ Ciclo de status (rascunho → processando → pronto/erro)
- ✅ Infraestrutura nova (storage, fila, worker) em Docker

**Entregáveis:** Decisões técnicas, artefatos de planejamento, módulo de vídeos, testes verdes, Definition of Done completa.

---

## 🔍 Etapas do Plano (Pipeline de Desenvolvimento)

### **ETAPA 01: RESEARCH — Decisões Técnicas** 🔬
**Status:** ⏳ Aguardando Execução  
**Artefato:** `docs/decisions/technical-decisions-phase-03-videos.md`

#### Decisões em Aberto (Ordem de Prioridade)

| Decisão | Contexto | Opções | Prazo |
|---------|----------|--------|-------|
| **Tecnologia de Fila** | Projeto deixa em aberto (TBD) | Redis Queue, Bull, RabbitMQ, AWS SQS | **CRÍTICA** |
| **Estratégia de Upload** | 10GB sem travar API | URL pré-assinada (S3), multipart, streaming | **CRÍTICA** |
| **Worker de Vídeo** | Como processa e gera thumbnail | FFmpeg + FFprobe, container separado | **CRÍTICA** |
| **Estratégia de Streaming** | Reprodução sem download completo | Range requests (206), HLS | **ALTA** |
| **URL Única** | Identificador do vídeo | UUID v4, slug customizável, hash | **MÉDIA** |
| **Ciclo de Status** | Estados e transições | Draft → Processing → Ready/Error | **MÉDIA** |
| **Organização de Storage** | Estrutura de buckets/chaves | Por canal, por vídeo, flat | **BAIXA** |

**Tasks de Research:**
- [ ] Pesquisar filas: desempenho, overhead Docker, integração com NestJS
- [ ] Estudar estratégia de upload assíncrono (não passar 10GB pela API)
- [ ] Revisar FFmpeg em container e geração de thumbnail
- [ ] Validar opções de streaming (range vs. HLS vs. streaming progressivo)
- [ ] Documentar trade-offs e recomendação de cada decisão

**Responsável:** Claude (IA + pesquisa MCP context7)  
**Deadline:** Antes de ETAPA 02

---

### **ETAPA 02: PLANEJAMENTO — Pipeline Context → Validate → Resolve → Build** 📐
**Status:** ⏳ Aguardando Execução  
**Artefatos:**
- `docs/phases/phase-03-videos/context.md` (plan-context)
- `docs/phases/phase-03-videos/validation.md` (plan-validate — **deve fechar em CLEAN**)
- `docs/phases/phase-03-videos/library-refs.md` (plan-resolve)
- `docs/phases/phase-03-videos/phase-03-videos.md` (plan-build — **o plano executável**)

#### Fluxo de Execução

```
RESEARCH (decisões)
       ↓
  context.md (consolidar contexto da fase)
       ↓
  validation.md (encontrar gaps e inconsistências)
       ↓
    DIRTY?
    ├─ SIM → plan-resolve (fixar libs, completar decisões)
    │        ↓
    │        volta ao validation.md
    │        ↓
    │     CLEAN?
    │     ├─ SIM → continua
    │     └─ NÃO → loop resolve-validate
    │
    └─ NÃO (CLEAN) → plan-build (gerar o plano: SIs + Technical Specs + Dependency Map)
```

**Checklist de Planejamento:**

- [ ] **context.md:** Resumo da fase, dependências, requisitos do projeto-plan.md
- [ ] **validation.md:** Verificar decisões completas, libs confirmadas, sem gaps de dependência
- [ ] **Iteração Resolve-Validate:** Até validation.md = CLEAN
- [ ] **library-refs.md:** Listar libs novas (fila, storage SDK, FFmpeg binding) com versões via context7
- [ ] **phase-03-videos.md:** Plano com Step Implementations (SI-03.1 a SI-03.x)
  - Technical Specifications: Data Model, API Contracts, Authorization Matrix, Error Catalog, **Events/Messages** (fila)
  - Dependency Map: quem depende de quem (API → fila, worker → DB, etc.)
  - Deliverables: lista de artefatos + testes esperados

**Responsável:** Claude (IA + skills plan-*)  
**Deadline:** validation.md CLEAN antes de ETAPA 03

---

### **ETAPA 03: IMPLEMENTAÇÃO — SI a SI com Testes Verdes** 🏗️
**Status:** ⏳ Aguardando Execução  
**Artefato:** `docs/phases/phase-03-videos/progress.md` (atualizar a cada SI)

#### Estrutura de SIs (Do Plano)

Esperado no plan-build:

- **SI-03.1:** Setup infraestrutura (storage, fila, worker no compose.yaml)
- **SI-03.2:** Entidade e migration de vídeos
- **SI-03.3:** Upload — API endpoint + pré-cadastro de rascunho
- **SI-03.4:** Fila e worker — processamento assíncrono
- **SI-03.5:** Processamento — duração, metadados, thumbnail
- **SI-03.6:** Streaming e download — endpoints de reprodução
- **SI-03.7:** Testes — unit, integração, e2e

(Exato número e ordem definido pelo plan-build)

**Ciclo por SI:**

```
SI atual (ex.: SI-03.3)
    ↓
Implementar código (controller, service, repository, testes)
    ↓
npm test (apenas testes do SI) — 🟢 verde?
    ├─ NÃO → debug e fix
    │        ↓
    │        npm test (de novo)
    │
    └─ SIM → npm run test:e2e (se aplicável) — 🟢?
            ├─ NÃO → fix
            └─ SIM → atualizar progress.md e passar ao SI seguinte
```

**Dentro de cada SI:**

- [ ] Implementar código (controllers, services, repositories, entities)
- [ ] Escrever testes (unit, integração, e2e conforme SI)
- [ ] Rodar suite do SI — deve passar 100%
- [ ] Validar com a spec do plano (contratos, autorizações, eventos)
- [ ] Atualizar `progress.md` (SI: ✅ DONE, testes: 5/5 pass)

**Responsável:** Claude (IA + implement skill)  
**Deadline:** Todos os SIs DONE com testes verdes

---

### **ETAPA 04: VALIDAÇÃO FINAL — Definition of Done** ✅
**Status:** ⏳ Aguardando Execução

#### Checklist do CLAUDE.md

```bash
# Dentro de nestjs-project/

# 1. Testes
npm test                                    # unit + integração → 🟢 pass
npm run test:e2e                           # e2e (supertest) → 🟢 pass

# 2. Type-check
npx tsc --noEmit                           # saída: exit code 0

# 3. Lint
npm run lint                                # ESLint → 🟢 pass

# 4. Infra
docker compose ps                          # todos os serviços: running/healthy
docker compose logs -f                     # sem erros críticos
```

**Itens do Critério de Aceite:**

- [ ] Testes unit + integração + e2e verdes
- [ ] `tsc --noEmit` exit 0
- [ ] `npm run lint` pass
- [ ] Docker compose: storage, fila, worker subindo
- [ ] Git Flow: trabalho em `feature/phase-03-videos` a partir de `dev`
- [ ] CLAUDE.md atualizado com seção de vídeos
- [ ] Commits descritivos e rastreáveis

**Responsável:** Alessandro (usuário) + Claude (verificação)  
**Deadline:** Antes do push final

---

### **ETAPA 05: ENTREGA — Git e Revisão** 📦
**Status:** ⏳ Aguardando Execução

#### Artefatos Entregáveis

```
mba-ia-greenfield-project/
├── docs/
│   ├── decisions/
│   │   └── technical-decisions-phase-03-videos.md     ✅
│   └── phases/
│       └── phase-03-videos/
│           ├── context.md                             ✅
│           ├── validation.md (CLEAN)                  ✅
│           ├── library-refs.md                        ✅
│           ├── phase-03-videos.md (plano + SIs)       ✅
│           └── progress.md                            ✅
├── nestjs-project/
│   ├── CLAUDE.md (atualizado)                         ✅
│   ├── compose.yaml (+ storage, fila, worker)         ✅
│   ├── src/videos/                                    ✅
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── entities/
│   │   └── videos.module.ts
│   ├── src/database/migrations/
│   │   └── *-CreateVideos.ts                          ✅
│   └── (worker conforme plano)                        ✅
└── (CLAUDE.md raiz — se houver mudanças)              ✅
```

#### Steps Finais

- [ ] Todos os SIs implementados
- [ ] Todos os testes passando
- [ ] Definition of Done completa
- [ ] Branch `feature/phase-03-videos` criada a partir de `dev`
- [ ] Commits com mensagens descritivas
- [ ] Rebase/squash se necessário (conforme Git Flow)
- [ ] PR para `dev` pronto (sem merge na main)
- [ ] Revisão manual dos Critérios de Aceite

**Responsável:** Alessandro (usuário final)  
**Deadline:** Data de fechamento da fase

---

## 🛠️ Instrumentos e Ferramentas Disponíveis

### **IA — Claude Code + Skills Bundled**
✅ Disponível no projeto via `.claude/`

| Skill | Fase | Entrada | Saída |
|-------|------|---------|-------|
| `research` | 01 | Decisões em aberto | technical-decisions-*.md |
| `plan-context` | 02 | Decisões + project-plan.md | context.md |
| `plan-validate` | 02 | context.md | validation.md (clean/dirty) |
| `plan-resolve` | 02 | validation.md (dirty) + context | library-refs.md + contexto atualizado |
| `plan-build` | 02 | validation.md (clean) + context | phase-*.md com SIs + Tech Specs |
| `implement` | 03 | phase-*.md (plano) | código + progress.md |
| `verify` | 04 | branch com código | resultado de testes + tsc + lint |

**Como usar:**
```bash
/research "Decisões da Fase 03: fila, upload, worker"
/plan-context
/plan-validate
/plan-resolve
/plan-build
/implement
/verify
```

---

### **MCP Servers (Servidores de Contexto)**

Configurados em `.mcp.json`:

| Server | Capacidade | Uso Nesta Fase |
|--------|-----------|----------------|
| **context7** | Consultar docs oficiais de libs (npm, GitHub) | ✅ Pesquisar Bull, MinIO SDK, FFmpeg bindings |
| **postgres** | Executar queries no banco real (dev) | ✅ Testar migration de vídeos, verificar schema |
| **webstorm** | IDE integration (JetBrains) | ✅ Se usar WebStorm; opcional |

**Exemplo de uso context7:**
```
/research "context7: Bull queue library npm docs"
→ retorna versão, APIs, exemplos, best practices
```

---

### **Git Flow & Branches**

Convenção do projeto (CLAUDE.md):

```
main
  ↑
dev (integração)
  ↑
feature/phase-03-videos (seu trabalho)
```

**Commands:**
```bash
# Setup
git checkout -b feature/phase-03-videos origin/dev

# Trabalho
git add <arquivos>
git commit -m "SI-03.2: Entidade e migration de vídeos"

# Antes de terminar
git rebase -i dev  # (se houver squash necessário)
git push origin feature/phase-03-videos

# PR (não merge na main, apenas em dev)
gh pr create --base dev --title "Fase 03: Upload e Processamento de Vídeos"
```

---

### **Docker Compose**

Atual (`nestjs-project/compose.yaml`):
```yaml
services:
  nestjs-api:    # API NestJS
  db:            # PostgreSQL 17
  mailpit:       # Email (dev)
```

**Novo (esperado após SI-03.1):**
```yaml
services:
  nestjs-api:    # API NestJS
  db:            # PostgreSQL 17
  mailpit:       # Email (dev)
  minio:         # Object Storage (S3-compatible)
  redis:         # Fila (se Bull + Redis, por exemplo)
  worker:        # Worker de vídeo (FFmpeg + NestJS consumer)
```

**Validar após setup:**
```bash
docker compose ps         # todos: running/healthy
docker compose logs       # sem erros
docker compose down       # parar tudo
```

---

### **NPM Scripts (Backend)**

Já existentes (nestjs-project/package.json):

```bash
npm run start:dev                  # Dev server hot-reload
npm test                           # Jest: unit + integração
npm run test:watch                # Watch mode
npm run test:cov                  # Coverage
npm run test:e2e                  # Supertest e2e
npm run lint                       # ESLint + auto-fix
npm run format                    # Prettier
npx tsc --noEmit                  # Type-check
npm run migration:run             # Run migrations
npm run migration:generate        # Generate migration
```

**Ciclo de desenvolvimento:**
```bash
# Terminal 1: Dev server
docker compose up -d
docker compose exec nestjs-api npm run start:dev

# Terminal 2: Testes (durante desenvolvimento)
docker compose exec nestjs-api npm test -- --watch -- src/videos

# Terminal 3: Type-check
docker compose exec nestjs-api npx tsc --noEmit
```

---

### **Estrutura de Testes (Convenção do Projeto)**

Sufixos esperados:

| Tipo | Suffix | Localização | Exemplo |
|------|--------|------------|---------|
| **Unit** | `*.spec.ts` | Próximo ao arquivo | `upload.service.spec.ts` |
| **Integração** | `*.integration-spec.ts` | Próximo ao arquivo | `videos.repository.integration-spec.ts` |
| **E2E** | `*.e2e-spec.ts` | `test/` raiz | `videos.e2e-spec.ts` |

**Padrão AAA (Arrange-Act-Assert):**
```typescript
describe('VideoService', () => {
  it('should create a draft video on upload start', async () => {
    // Arrange
    const channelId = await createTestChannel();
    
    // Act
    const video = await videoService.createDraft(channelId, 'test.mp4');
    
    // Assert
    expect(video.status).toBe('draft');
    expect(video.channelId).toBe(channelId);
  });
});
```

---

### **Documentação do Projeto (Referências)**

Arquivos a revisar:

| Arquivo | Propósito |
|---------|-----------|
| `docs/project-plan.md` | **Requisitos da Fase 03** (capacidades esperadas) |
| `CLAUDE.md` (raiz) | **Regras globais do projeto** |
| `nestjs-project/CLAUDE.md` | **Regras NestJS** (controllers, services, tests, migrations) |
| `docs/diagrams/software-arch.mermaid` | **Arquitetura** (C4 — mostra storage, fila, worker) |
| `docs/phases/phase-02-auth/` | **Referência de formato** (como estruturar a pasta da fase) |

---

## 📊 Dependências e Riscos

### **Dependências Técnicas**

```
Decisões (research)
    ↓
Contexto + Decisões
    ↓
Validação (deve fechar CLEAN)
    ↓
Plano (SIs + Tech Specs)
    ↓
Implementação (SI a SI)
    ↓
Testes verdes
    ↓
Definition of Done
```

### **Riscos Conhecidos**

| Risco | Mitigação |
|-------|-----------|
| Plano frouxo → retrabalho | Revisar criticamente plan-build e SIs antes de implementar |
| Upload grande trava API | Usar estratégia pré-assinada/multipart (decisão crítica) |
| Fila sem testes reais | Rodar worker + fila no Compose, testar com e2e |
| Tsc/lint quebrado no final | Rodar `npx tsc --noEmit` e `npm run lint` a cada SI |
| Commits na main por engano | Trabalhar em `feature/phase-03-videos`, usar `git branch -vv` para verificar tracking |

---

## 📅 Cronograma Estimado

| Etapa | Atividade | Duração Estimada | Deadline |
|-------|-----------|------------------|----------|
| 01 | Research — decisões técnicas | 2-3h | T+3h |
| 02 | Planejamento — context → validate → build | 3-4h | T+7h |
| 03 | Implementação — SIs com testes | 8-12h | T+20h |
| 04 | Validação final — Definition of Done | 1-2h | T+22h |
| 05 | Entrega — Git, PR, revisão | 1h | T+23h |

**T = Início agora (2026-07-31)**

---

## ✨ Checklist de Início

Antes de começar a **ETAPA 01 (RESEARCH)**:

- [ ] Backend está rodando (`docker compose up -d`, testes verdes)
- [ ] Você leu `docs/project-plan.md` (Fase 03)
- [ ] Você leu a estrutura de `docs/phases/phase-02-auth/` (referência de formato)
- [ ] Você conhece o CLAUDE.md (`nestjs-project/CLAUDE.md`)
- [ ] `.mcp.json` está configurado (context7, postgres disponíveis)
- [ ] Branch `feature/phase-03-videos` foi criada e está checked out
- [ ] Você tem este arquivo (`PLANO_ACAO_FASE_03.md`) para referência

**Próxima ação:** Rodará a skill `/research` para pesquisar as decisões técnicas aberto (fila, upload, worker, streaming).

---

## 📝 Notas e Observações

- Este plano é um "north star" — ajusta conforme o plano detalhado (phase-03-videos.md) sair do plan-build.
- Cada skill (research, plan-context, etc.) gera um artefato; este plano conecta tudo.
- O `progress.md` é atualizado durante a **ETAPA 03** (implementação), SI por SI.
- Se divergir significativamente do plano, atualize este documento para manter a coerência.

---

**Criado por:** Claude Code + Alessandro Traversi  
**Projeto:** StreamTube Fase 03  
**Status Inicial:** 🟡 Planejamento  
**Última atualização:** 2026-07-31
