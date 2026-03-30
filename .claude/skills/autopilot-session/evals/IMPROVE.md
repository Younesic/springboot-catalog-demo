# ♻️ Auto-amélioration du skill autopilot-session

## C'est quoi

Un loop qui teste automatiquement le skill contre les 6 scénarios de `evals/evals.json`,
identifie quelles règles échouent, modifie le `SKILL.md`, et recommence — sans toi.

Résultat attendu : passer de ~60-70% à 85-95% de réussite sur les assertions.

---

## Quand le lancer

- Quand tu remarques que Claude répète une erreur (ex: il marque passes:true sans tester)
- Quand tu ajoutes un nouveau projet et veux recalibrer le skill
- Idéalement overnight — ça prend 30-60 min selon le nombre d'itérations

---

## Étape 1 — Lancer depuis Claude Code

Dans Claude Code, dis simplement :

```
Améliore le skill autopilot-session en utilisant le skill-creator.
Les evals sont dans .claude/skills/autopilot-session/evals/evals.json.
Lance jusqu'à 5 itérations ou jusqu'à 90% de pass rate.
```

Claude Code prendra en charge le loop complet.

---

## Étape 2 — Ce que Claude va faire automatiquement

1. Lire `evals/evals.json` (6 scénarios, 30 assertions au total)
2. Lancer chaque scénario avec et sans le skill (baseline)
3. Grader chaque assertion : passée ✅ ou échouée ❌
4. Identifier les patterns d'échec
5. Réécrire les parties du `SKILL.md` qui causent les échecs
6. Recommencer — jusqu'à 5 itérations ou 90% de pass rate
7. Mettre à jour `evals/history.json` avec les résultats

---

## Étape 3 — Ce que tu regardes

À la fin, Claude ouvre un rapport avec :
- Le taux de réussite avant/après pour chaque assertion
- Les changements apportés au `SKILL.md`
- Les assertions qui restent difficiles (et pourquoi)

Tu valides ou tu demandes des ajustements manuels.

---

## Ajouter une nouvelle assertion

Si tu identifies un problème récurrent avec Claude, ajoute un scénario dans `evals/evals.json` :

```json
{
  "id": 7,
  "prompt": "Décris la situation problématique exacte",
  "expected_output": "Ce que Claude devrait faire",
  "files": [],
  "expectations": [
    "Assertion binaire précise et vérifiable",
    "Autre assertion binaire"
  ]
}
```

Puis relance le loop. Le skill s'adaptera automatiquement.

---

## Règle d'or pour les assertions

Une bonne assertion est :
- **Binaire** — vrai ou faux, pas "assez bien"
- **Observable** — vérifiable en lisant la réponse de Claude
- **Spécifique** — "L'agent lit claude-progress.txt avant de coder" pas "L'agent gère bien le contexte"
