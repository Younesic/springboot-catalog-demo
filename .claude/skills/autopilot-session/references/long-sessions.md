# Longues sessions — Protocole complet

## Déclencheurs de checkpoint

Appelle `bash claude-checkpoint.sh "message"` quand :
- Tu termines une sous-tâche significative
- Tu t'apprêtes à attaquer quelque chose de complexe
- ~15 actions outils se sont écoulées
- Tu perçois que le contexte se remplit

```bash
bash claude-checkpoint.sh "implémentation du login terminée"
```

---

## Après une compaction — OBLIGATOIRE

Ces 4 étapes avant tout le reste, sans exception :

```bash
cat REANCHOR.md          # règles essentielles compactes
cat claude-progress.txt  # état du projet
git log --oneline -5     # derniers commits
```

Puis confirmer à l'utilisateur :
> "Contexte recompacté. Je reprends depuis : [dernière tâche dans progress.txt]"

---

## Compteur de session

Après 8+ checkpoints dans la même session :
- Prévenir l'utilisateur que la session est longue
- Proposer de terminer proprement et de reprendre dans une nouvelle session
- Ne jamais continuer indéfiniment sans signal

---

## Sauvegarder l'état si session interrompue

```bash
bash claude-checkpoint.sh "session interrompue — [état actuel]"
git stash push -m "wip: [description]"
```
