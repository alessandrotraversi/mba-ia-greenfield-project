# 📑 Índice de Documentação — Fase 03

**Projeto:** StreamTube  
**Fase:** 03 — Upload e Processamento de Vídeos  
**Status:** 🟢 Documentação Pronta  
**Data:** 2026-07-31

---

## 📚 Estrutura de Arquivos Criados

### **Na Raiz do Projeto** (3 documentos novos)

```
/Users/alessandrotraversi/Documents/fc/mba-ia-greenfield-project/
├── RESUMO_EXECUTIVO_FASE_03.md          ← COMECE AQUI (30 min)
├── PLANO_ACAO_FASE_03.md                ← Leia depois (detalhes)
├── INSTRUMENTOS_DISPONÍVEIS.md          ← Referência rápida
└── INDICE_DOCUMENTACAO.md               ← Este arquivo
```

### **Na Pasta de Fases (Serão criados durante desenvolvimento)**

```
docs/phases/phase-03-videos/
├── context.md                           ← Após /plan-context
├── validation.md                        ← Após /plan-validate (CLEAN)
├── library-refs.md                      ← Após /plan-resolve
├── phase-03-videos.md                   ← Após /plan-build (PLANO EXECUTÁVEL)
└── progress.md                          ← Durante /implement (SI por SI)
```

### **De Decisões**

```
docs/decisions/
└── technical-decisions-phase-03-videos.md  ← Após /research
```

---

## 🗂️ Guia de Leitura por Persona

### **👨‍💼 Você é um Gerente (5 min)**
1. Leia: **RESUMO_EXECUTIVO_FASE_03.md**
2. Veja: Roadmap (T+0h até T+21h), Métricas de Sucesso

### **👨‍💻 Você é o Desenvolvedor (30 min)**
1. Leia: **RESUMO_EXECUTIVO_FASE_03.md** (TL;DR)
2. Leia: **PLANO_ACAO_FASE_03.md** (5 etapas)
3. Tenha à mão: **INSTRUMENTOS_DISPONÍVEIS.md** (referência)
4. Comece: `/research` (ETAPA 01)

### **🤖 Você é a IA (Claude Code) (5 min)**
1. Leia: **INSTRUMENTOS_DISPONÍVEIS.md** (skills, MCP, testes)
2. Referencie: **PLANO_ACAO_FASE_03.md** (pipeline, estrutura)
3. Implemente: Conforme cada skill (research → plan → implement → verify)

---

## 📋 Conteúdo de Cada Documento

### **1️⃣ RESUMO_EXECUTIVO_FASE_03.md**
**Comprimento:** ~8 páginas  
**Tempo de Leitura:** 15-30 min  
**Para Quem:** Gestores, leads, visão rápida

**Seções:**
- ⚡ TL;DR (30 seg)
- 🎯 Objetivo da Fase (7 capacidades)
- 📊 Arquitetura (diagrama visual)
- 📋 Itens Entregáveis
- 🛣️ Roadmap de Execução (T+0h a T+21h)
- 🔑 Decisões Técnicas Abertas
- 📊 Métricas de Sucesso
- 🎯 Próximos Passos

**Quando Consultar:** No início para entender o escopo; durante para validar progresso

---

### **2️⃣ PLANO_ACAO_FASE_03.md**
**Comprimento:** ~15 páginas  
**Tempo de Leitura:** 45-60 min  
**Para Quem:** Desenvolvedores, arquitetos, tech leads

**Seções:**
- 📋 Visão Geral
- 🔍 ETAPA 01: RESEARCH (decisões em aberto)
- 📐 ETAPA 02: PLANEJAMENTO (pipeline context → validate → build)
- 🏗️ ETAPA 03: IMPLEMENTAÇÃO (SI a SI)
- ✅ ETAPA 04: VALIDAÇÃO (Definition of Done)
- 📦 ETAPA 05: ENTREGA (Git, PR)
- 🛠️ Instrumentos (skills, MCP, Docker)
- 📊 Dependências e Riscos
- 📅 Cronograma Estimado
- ✨ Checklist de Início

**Quando Consultar:** Referência constante durante desenvolvimento; checklist antes de começar

---

### **3️⃣ INSTRUMENTOS_DISPONÍVEIS.md**
**Comprimento:** ~20 páginas  
**Tempo de Leitura:** 30-45 min (ao referir ao longo do tempo)  
**Para Quem:** Desenvolvedores, arquitetos

**Seções:**
- 🤖 IA — Claude Code + Skills (7 skills descritas em detalhes)
- 🌐 MCP Servers (context7, postgres, webstorm)
- 📦 Dependências de Projeto (libs a instalar)
- 🐳 Docker Compose (atual + esperado)
- 🧪 Testes (tipos, convenção, exemplos)
- 📚 Documentação de Referência
- 💡 Dicas de Uso Prático
- 🚨 Checklist Antes de Começar

**Quando Consultar:** Referência rápida enquanto trabalha (abrir ao lado)

---

### **4️⃣ INDICE_DOCUMENTACAO.md**
**Este Arquivo**  
**Comprimento:** ~5 páginas  
**Tempo de Leitura:** 10 min  
**Para Quem:** Todos (descobrir qual documento ler)

**Seções:**
- 📚 Estrutura de Arquivos Criados
- 🗂️ Guia de Leitura por Persona
- 📋 Conteúdo de Cada Documento
- 🎯 Fluxo de Desenvolvimento
- 🔗 Conexão Entre Documentos
- ⚠️ Dependências de Leitura

---

## 🎯 Fluxo de Desenvolvimento e Documentação

```
START
  │
  ├─→ RESUMO_EXECUTIVO_FASE_03.md (leia rápido)
  │     │
  │     └─→ PLANO_ACAO_FASE_03.md (entenda as 5 etapas)
  │           │
  │           └─→ Cria branch feature/phase-03-videos
  │                 │
  │                 └─→ ETAPA 01: RESEARCH (2-3h)
  │                       │
  │                       └─ /research
  │                           ↓
  │                           technical-decisions-phase-03-videos.md
  │                           (artefato: docs/decisions/)
  │                           │
  │                           └─→ ETAPA 02: PLANEJAMENTO (3-4h)
  │                                 │
  │                                 └─ /plan-context
  │                                 └─ /plan-validate (volta se DIRTY)
  │                                 └─ /plan-resolve (completa pendências)
  │                                 └─ /plan-build
  │                                     ↓
  │                                     phase-03-videos.md (O PLANO)
  │                                     (artefatos: docs/phases/phase-03-videos/)
  │                                     │
  │                                     └─→ ETAPA 03: IMPLEMENTAÇÃO (8-12h)
  │                                           │
  │                                           └─ /implement SI-03.1
  │                                           └─ /implement SI-03.2
  │                                           └─ ... (ver progress.md)
  │                                           └─ /implement SI-03.7
  │                                               ↓
  │                                               progress.md (SI por SI)
  │                                               src/videos/
  │                                               compose.yaml atualizado
  │                                               │
  │                                               └─→ ETAPA 04: VALIDAÇÃO (1-2h)
  │                                                     │
  │                                                     └─ /verify
  │                                                     └─ npm test ✅
  │                                                     └─ tsc ✅
  │                                                     └─ lint ✅
  │                                                     └─ CLAUDE.md atualizado
  │                                                         │
  │                                                         └─→ ETAPA 05: ENTREGA (1h)
  │                                                               │
  │                                                               └─ git push
  │                                                               └─ PR para dev
  │                                                               └─ ✅ DONE
  │
  └─→ INSTRUMENTOS_DISPONÍVEIS.md (abra ao lado durante desenvolvimento)
```

---

## 🔗 Conexão Entre Documentos

### **RESUMO_EXECUTIVO → PLANO_ACAO**
- Resumo fornece **visão geral**
- Plano fornece **detalhes e checklist**
- Relação: Resumo resume; Plano expande

### **PLANO_ACAO → INSTRUMENTOS**
- Plano diz **QUANDO** usar skills
- Instrumentos diz **COMO** usar skills
- Relação: Plano orquestra; Instrumentos documenta

### **PLANO_ACAO → docs/phases/phase-03-videos/**
- Plano estrutura as **5 etapas**
- Cada etapa gera um **artefato** na pasta
- Relação: Plano → checklist → artefatos

### **INSTRUMENTOS → .mcp.json**
- Instrumentos lista **MCP servers**
- .mcp.json **configura** os servers
- Relação: Instrumentos documenta; config ativa

---

## ⚠️ Dependências de Leitura

**Ordem Recomendada:**

```
1️⃣  RESUMO_EXECUTIVO_FASE_03.md        (obrigatório)
    ↓
2️⃣  PLANO_ACAO_FASE_03.md              (obrigatório)
    ↓
3️⃣  INSTRUMENTOS_DISPONÍVEIS.md        (referência constante)
    ↓
4️⃣  docs/project-plan.md               (requisitos oficiais)
    ↓
5️⃣  nestjs-project/CLAUDE.md           (regras NestJS)
    ↓
6️⃣  Comece: /research
```

**O que NÃO fazer:**
- ❌ Não comece pelo INSTRUMENTOS (leia plano primeiro)
- ❌ Não pule o RESUMO (ele resume decisões)
- ❌ Não implemente sem ler o PLANO_ACAO (vai ficar perdido)

---

## 🎓 Glossário de Termos Usados

| Termo | Definição | Documento |
|-------|-----------|-----------|
| **SI (Step Implementation)** | Unidade de implementação (ex: SI-03.1) | PLANO_ACAO, phase-03-videos.md |
| **Definition of Done** | Critério de aceitação (testes + tsc + lint) | PLANO_ACAO, CLAUDE.md |
| **Skill** | Ferramenta de IA (ex: /research, /implement) | INSTRUMENTOS, PLANO_ACAO |
| **MCP Server** | Servidor de contexto (context7, postgres) | INSTRUMENTOS |
| **Artefato** | Documento gerado (decisões, plano, progress) | PLANO_ACAO |
| **CLEAN** | Status de validation.md pronto para implementar | PLANO_ACAO, INSTRUMENTOS |
| **DIRTY** | Status de validation.md com gaps (volta a resolve) | PLANO_ACAO, INSTRUMENTOS |
| **Data Model** | Schema do banco (tabela videos) | phase-03-videos.md |
| **API Contracts** | Especificação de endpoints | phase-03-videos.md |
| **Events/Messages** | Mensagens da fila (video.upload.done) | phase-03-videos.md |

---

## 🔄 Como Usar Este Índice

**Pergunta:** "Por onde começo?"  
→ Leia: RESUMO_EXECUTIVO_FASE_03.md

**Pergunta:** "Como fica organizado?"  
→ Leia: INDICE_DOCUMENTACAO.md (este arquivo)

**Pergunta:** "Qual é o passo seguinte?"  
→ Leia: PLANO_ACAO_FASE_03.md (ETAPA atual)

**Pergunta:** "Como uso /research?"  
→ Leia: INSTRUMENTOS_DISPONÍVEIS.md (seção Skills)

**Pergunta:** "Qual é a estrutura esperada de testes?"  
→ Leia: INSTRUMENTOS_DISPONÍVEIS.md (seção Testes)

**Pergunta:** "Preciso de alguma lib especial?"  
→ Leia: INSTRUMENTOS_DISPONÍVEIS.md (seção Dependências)

---

## ✅ Checklist Antes de Começar a Ler

- [ ] Você tem acesso à raiz do projeto
- [ ] Você pode ver os 3 novos arquivos criados
- [ ] Você tem ~2 horas livres para ler + pesquisar
- [ ] Backend está rodando (docker compose up -d)
- [ ] Você leu docs/project-plan.md (Fase 03)
- [ ] Branch `feature/phase-03-videos` foi criada

---

## 📞 Suporte Rápido

**Dúvida?** Primeiro lugar a consultar:

- "Que arquivo leia?" → **INDICE_DOCUMENTACAO.md** (este)
- "Como começo?" → **RESUMO_EXECUTIVO_FASE_03.md**
- "Detalhes das 5 etapas?" → **PLANO_ACAO_FASE_03.md**
- "Como funciona /research?" → **INSTRUMENTOS_DISPONÍVEIS.md**
- "Quais são os requisitos?" → **docs/project-plan.md**
- "Regras NestJS?" → **nestjs-project/CLAUDE.md**

---

**Criado por:** Claude Code  
**Data:** 2026-07-31  
**Status:** 🟢 Documentação Completa  
**Próximo:** Leia RESUMO_EXECUTIVO_FASE_03.md →
