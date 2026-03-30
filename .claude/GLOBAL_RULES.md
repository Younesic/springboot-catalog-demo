# 🤖 Claude Code — Règles Globales (Auto-chargées)

## 🧠 ANTI-HALLUCINATION
- Si tu n'es pas certain à 90%+, dis-le explicitement : "Je ne suis pas certain, voici ce que je sais..."
- Ne génère JAMAIS de code que tu n'as pas mentalement tracé ligne par ligne
- Si une API / librairie / version est ambiguë, **demande plutôt qu'inventer**
- Avant de déclarer une feature "terminée", vérifie-la end-to-end
- Préfère dire "je ne sais pas" plutôt que confabulation

## 🎯 ANTI-DÉRIVE DE FOCUS
- **UNE tâche à la fois** — ne commence pas la suivante avant que la précédente soit propre
- Si tu remarques un autre bug en chemin → note-le dans `claude-progress.txt`, ne dévie pas
- Ne change JAMAIS le comportement de code non concerné par la tâche en cours
- Si la tâche dépasse 30 min estimée → décompose-la en sous-tâches d'abord

## 📦 GESTION DU CONTEXTE
- Au démarrage de chaque session : lis `claude-progress.txt` + `git log --oneline -10`
- Avant de répondre sur l'architecture : relis les fichiers clés concernés
- Ne te fie JAMAIS à ta mémoire pour le code — lis toujours le fichier actuel
- Si le contexte devient flou : `pwd`, `ls`, `cat claude-progress.txt`

## ⏱️ PROTOCOLE LONGUE SESSION (contexte > 60%)

### Déclencheurs de checkpoint — appelle `bash claude-checkpoint.sh "message"` quand :
- Tu viens de terminer une sous-tâche significative
- Tu sens que le contexte se remplit (beaucoup d'échanges, fichiers lus)
- Avant d'attaquer une tâche complexe (filet de sécurité)
- Toutes les ~15 actions outils (lecture fichier, écriture, bash)
- AVANT toute compaction (si tu en es averti)

### Après une compaction automatique — OBLIGATOIRE :
1. `cat REANCHOR.md` — relis les règles essentielles (version compacte)
2. `cat claude-progress.txt` — reprends le fil
3. `git log --oneline -5` — vois le dernier état du code
4. Confirme à l'utilisateur : "Contexte recompacté — je reprends depuis [état]"
5. Ne fais RIEN d'autre avant ces 4 étapes

### Sous-agents pour tâches lourdes :
- Si une sous-tâche est estimée > 45 min → délègue-la à un sous-agent isolé
- Passe-lui UNIQUEMENT les fichiers nécessaires (pas tout le contexte parent)
- Le sous-agent écrit son résultat dans un fichier dédié (`output-[tache].md`)
- Le contexte parent reste léger et garde le focus sur l'objectif principal
- Pattern : "Investigate X and write findings to `output-X.md`, then stop."

## ✅ PROTOCOLE FIN DE SESSION
Avant de terminer une session, TOUJOURS :
1. Commit git avec message descriptif : `git commit -m "feat: [description précise]"`
2. Mettre à jour `claude-progress.txt` avec ce qui a été fait et ce qui reste
3. Laisser le code dans un état propre (pas de TODO non documentés, pas de console.log de debug)
4. Si une feature est "en cours" → la noter explicitement comme incomplète

## 🔍 PROTOCOLE DÉBUT DE SESSION
1. `pwd` — vérifier le répertoire
2. `cat claude-progress.txt` — lire l'état du projet
3. `git log --oneline -10` — voir les derniers changements
4. Lancer les tests si disponibles
5. Choisir UNE seule tâche à traiter

## 🚫 INTERDICTIONS STRICTES
- Ne JAMAIS supprimer ou modifier des tests existants pour faire passer les tests
- Ne JAMAIS marquer une feature comme complète sans l'avoir testée
- Ne JAMAIS refactoriser du code hors scope de la tâche en cours
- Ne JAMAIS faire de commits avec du code cassé

## 💬 COMMUNICATION
- Si une instruction est ambiguë → demande une clarification AVANT de coder
- Si tu rencontres un blocage → explique le problème clairement, propose 2-3 options
- Estime toujours la complexité avant de commencer : Simple / Moyen / Complexe
