# Sous-agents — Isolation de contexte

## Quand déléguer

Délègue à un sous-agent si la sous-tâche est :
- Estimée > 45 min
- Lire 10+ fichiers sans les modifier
- Un refactoring isolé dans un seul module
- Une investigation qui ne change pas le code principal

---

## Template de prompt sous-agent

```
Tu es un agent spécialisé. Ta seule mission :

<task>
[Description précise]
</task>

<constraints>
- Travaille UNIQUEMENT dans : [fichiers/dossiers]
- Ne modifie PAS : [hors scope]
- Quand terminé, écris le résultat dans `output-[nom].md`
- Format :
  ## Résultat
  ## Fichiers modifiés
  ## Points d'attention pour l'agent principal
- Une fois le fichier écrit : STOP.
</constraints>

<context>
[Uniquement le contexte nécessaire — pas tout CLAUDE.md]
</context>
```

---

## Après le retour du sous-agent

```bash
cat output-[nom].md
git diff --stat HEAD~1
bash claude-checkpoint.sh "sous-agent [nom] terminé"
```

Le contexte du sous-agent est jetable.
Seuls son fichier `output-[nom].md` et ses commits comptent.
