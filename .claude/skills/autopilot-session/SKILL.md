---
name: autopilot-session
description: Gestion de session Claude Code avec anti-hallucination, focus et contexte. Utilise ce skill au DÉBUT de chaque session, après une compaction, ou quand tu te sens perdre le fil. Déclenche aussi sur : "reprends le contexte", "où en est-on", "état du projet", "qu'est-ce qui reste à faire", "on reprend", ou toute ouverture de session sur un projet avec CLAUDE.md ou AGENTS.md.
---

# Autopilot Session — Protocole de session

## Début de session (TOUJOURS)

```bash
bash init.sh
```

Si `init.sh` est absent :
```bash
cat claude-progress.txt 2>/dev/null
git log --oneline -5 2>/dev/null
```

Puis choisir **UNE seule feature** dans `feature_list.json` avec `passes: false`.
Annoncer le plan à l'utilisateur et **attendre confirmation** avant de commencer à coder.

---

## Après compaction (PRIORITÉ ABSOLUE)

Si le contexte a été compacté :
1. Lire `REANCHOR.md` en premier
2. Lire `claude-progress.txt`
3. Consulter `git log --oneline -5`
4. Confirmer à l'utilisateur depuis quel état on reprend

Ne commencer aucune action avant ces 4 étapes.

---

## Règles permanentes

**Anti-hallucination**
- Incertitude → dire "Je ne suis pas certain : voici ce que je sais..."
- Ne jamais inventer une API, une version, un comportement
- Si la question porte sur une version récente ou un comportement spécifique → proposer de vérifier la documentation officielle avant d'implémenter
- Réponse connue avec certitude → l'expliquer clairement en citant la source (documentation officielle, version connue, comportement vérifié)
- Lire le fichier avant d'écrire — jamais de mémoire

**Focus**
- UNE tâche à la fois, jusqu'à la fin
- Si l'utilisateur donne plusieurs tâches : choisir UNE, noter les autres dans `claude-progress.txt`, et expliquer pourquoi on ne les traite pas simultanément
- Priorité : bugs correctifs avant refactoring ou amélioration
- Bug remarqué en chemin → noter dans `claude-progress.txt`, ne pas dévier
- Ne jamais modifier du code hors scope de la tâche en cours

**Contexte**
- Avant toute réponse sur l'architecture : relire les fichiers concernés
- Si flou : `pwd` → `ls` → `cat claude-progress.txt`

**Interdictions strictes**
- Ne JAMAIS modifier des tests pour les faire passer
- Ne JAMAIS marquer `passes: true` sans avoir proposé ou exécuté un test end-to-end et obtenu confirmation — expliquer pourquoi cette vérification est nécessaire (une feature déclarée done sans test peut masquer des régressions)
- Ne JAMAIS commiter du code cassé
- Ne JAMAIS toucher aux fichiers listés dans la section `🔒 Fichiers intouchables` de CLAUDE.md

---

## Fin de session (TOUJOURS)

1. `git commit -m "feat/fix: [description précise]"`
2. Mettre à jour `claude-progress.txt` — ce qui est fait, ce qui reste
3. Feature en cours → laisser `passes: false` avec note dans `notes`
4. Code propre : pas de `console.log` de debug, pas de TODO non documentés

---

## Communication

- Instruction ambiguë → demander AVANT de coder
- Blocage → expliquer clairement + proposer 2-3 options
- Estimer la complexité : Simple / Moyen / Complexe

---

## Références

Pour les longues sessions (contexte > 60%) → lire `references/long-sessions.md`
Pour déléguer une sous-tâche lourde → lire `references/subagent.md`
