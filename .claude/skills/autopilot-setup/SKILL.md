---
name: autopilot-setup
description: Initialise ou retrofite les bonnes pratiques Claude Autopilot sur un projet. Déclenche sur : "initialise le projet", "configure autopilot", "ajoute claude-init", "mets en place les bonnes pratiques", "configure le projet pour Claude Code", "configure pour Codex", ou quand CLAUDE.md / AGENTS.md / feature_list.json sont absents au démarrage d'une session.
---

# Autopilot Setup — Initialisation de projet

## Détecter la situation

```bash
ls CLAUDE.md AGENTS.md feature_list.json 2>/dev/null
ls package.json requirements.txt pyproject.toml 2>/dev/null
ls .claude/skills/ 2>/dev/null
```

| Situation | Action |
|---|---|
| Aucun fichier autopilot ET aucun fichier projet (vierge) | Nouveau projet → `claude-init` |
| Aucun fichier autopilot MAIS fichiers projet présents (package.json, requirements.txt…) | Projet existant sans autopilot → `claude-retrofit` |
| Fichiers autopilot présents mais `.claude/skills/` absent ou vide | Projet existant → `claude-retrofit` |
| Tout présent (autopilot + skills) | Rien à faire → passer à `autopilot-session` |

---

## Nouveau projet — Claude Code

```bash
claude-init [nom-du-projet]
```

Après init → passer à `autopilot-session` pour démarrer le travail.

## Nouveau projet — Codex

```bash
codex-init [nom-du-projet]
```

## Projet existant — Claude Code

```bash
claude-retrofit
```

`claude-retrofit` préserve automatiquement le CLAUDE.md existant et détecte la stack (Next.js, FastAPI, React, Django…) depuis `package.json` ou `requirements.txt`. Ne pas créer ni modifier CLAUDE.md manuellement avant de lancer claude-retrofit.

## Projet existant — Codex

```bash
codex-retrofit
```

---

## Après l'init : 2 fichiers à compléter

**CLAUDE.md ou AGENTS.md** — remplir :
- Stack technique (langage, framework, tests, DB)
- Conventions de nommage
- Décisions d'architecture non-évidentes
- Section `🔒 Fichiers intouchables` si nécessaire

**feature_list.json** — ajouter les vraies features du projet :
```json
{
  "id": "F002",
  "category": "auth",
  "description": "L'utilisateur peut se connecter avec email/password",
  "priority": 2,
  "passes": false,
  "notes": ""
}
```

---

## Vérification finale

```bash
bash init.sh   ← doit afficher l'état du projet sans erreur
```

Si "Tout présent" : lancer `bash init.sh` pour confirmer l'état, puis passer à `autopilot-session`.
