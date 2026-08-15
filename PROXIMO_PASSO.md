# 🎯 Próximo Passo — Pipeline de Planejamento Fase 03

**Status Atual:** ✅ Decisões técnicas criadas  
**Arquivo:** docs/decisions/technical-decisions-phase-03-videos.md

**Próxima Ação:** Chamar a skill `/plan-context` para consolidar o contexto

---

## Como Proceder

Digite no prompt do Claude Code:

```
/plan-context "Fase 03: Upload e Processamento de Vídeos"
```

Isso vai:

1. Ler `technical-decisions-phase-03-videos.md` (decisões que criamos)
2. Ler `docs/project-plan.md` (requisitos da Fase 03)
3. Ler stack atual (CLAUDE.md, package.json, etc.)
4. Gerar `docs/phases/phase-03-videos/context.md`

---

## Pipeline Completo (após context.md)

```
/plan-context "Fase 03"    → context.md
        ↓
/plan-validate "Fase 03"   → validation.md (deve ser CLEAN)
        ↓
/plan-resolve "Fase 03"    → library-refs.md
        ↓
/plan-build "Fase 03"      → phase-03-videos.md (O PLANO!)
```

---

## Estrutura Esperada após Conclusão

```
docs/phases/phase-03-videos/
├── context.md                    ✅ (será criado)
├── validation.md                 ✅ (será criado)
├── library-refs.md               ✅ (será criado)
└── phase-03-videos.md            ✅ (será criado — O PLANO COM SIs)
```

---

**Pronto? Rode:**

```
/plan-context "Fase 03: Upload e Processamento de Vídeos"
```
