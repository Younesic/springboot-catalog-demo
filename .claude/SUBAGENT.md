# 🤖 Pattern Sous-Agent — Isolation de contexte

> Utilise ce pattern quand une sous-tâche est estimée > 45 min,
> ou quand tu veux préserver le contexte principal pour des décisions importantes.

## Quand déléguer à un sous-agent

| Situation | Action |
|---|---|
| Investigation (lire 10+ fichiers) | Sous-agent → écrit `output-investigation.md` |
| Refactoring isolé d'un module | Sous-agent → commit dédié |
| Tests à écrire en masse | Sous-agent → branch dédiée |
| Debug d'un bug complexe | Sous-agent → écrit `output-debug.md` |
| Tâche qui n'affecte pas l'objectif courant | Sous-agent → ne pollue pas le contexte |

## Template de prompt sous-agent

```
Tu es un agent spécialisé. Ta seule mission :

<task>
[Description précise de la sous-tâche]
</task>

<constraints>
- Travaille UNIQUEMENT dans : [liste des fichiers/dossiers concernés]
- Ne modifie PAS : [fichiers hors scope]
- Quand tu as terminé, écris ton résultat dans `output-[nom].md`
- Format du fichier de sortie :
  ## Résultat
  [Ce qui a été fait]
  ## Fichiers modifiés
  [Liste]
  ## Points d'attention pour l'agent principal
  [Ce que l'agent principal doit savoir]
- Une fois le fichier écrit, STOP. Ne continue pas.
</constraints>

<context>
[Coller UNIQUEMENT le contexte nécessaire — pas tout CLAUDE.md]
</context>
```

## Après le retour du sous-agent

```bash
# L'agent principal lit le résultat
cat output-[nom].md

# Vérifie les changements
git diff --stat HEAD~1

# Checkpoint
bash claude-checkpoint.sh "sous-agent [nom] terminé"

# Continue sur l'objectif principal
```

## Règle d'or

> Le contexte du sous-agent est **jetable**.
> Seul son fichier `output-[nom].md` et ses commits comptent.
> L'agent principal ne reprend que ces deux choses.
