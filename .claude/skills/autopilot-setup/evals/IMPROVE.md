# ♻️ Auto-amélioration du skill autopilot-setup

## C'est quoi

Un loop qui teste automatiquement le skill contre les 4 scénarios de `evals/evals.json`,
identifie quelles règles échouent, modifie le `SKILL.md`, et recommence — sans toi.

Résultat attendu : passer de ~60-70% à 85-95% de réussite sur les assertions.

---

## Quand le lancer

- Quand l'agent lance claude-init au lieu de claude-retrofit sur un projet existant (ou vice versa)
- Quand l'agent écrase un CLAUDE.md existant alors qu'il ne devrait pas
- Quand l'agent ne détecte pas correctement la stack du projet
- Idéalement overnight — ça prend 30-60 min selon le nombre d'itérations

---

## Étape 1 — Lancer depuis Claude Code

Dans Claude Code, dis simplement :

```
Améliore le skill autopilot-setup en utilisant le skill-creator.
Les evals sont dans .claude/skills/autopilot-setup/evals/evals.json.
Lance jusqu'à 5 itérations ou jusqu'à 90% de pass rate.
```

Claude Code prendra en charge le loop complet.

---

## Étape 2 — Ce que Claude va faire automatiquement

1. Lire `evals/evals.json` (4 scénarios, 20 assertions au total)
2. Grader chaque assertion contre le SKILL.md actuel : passée ✅ ou échouée ❌
3. Identifier les patterns d'échec
4. Réécrire les parties du `SKILL.md` qui causent les échecs
5. Recommencer — jusqu'à 5 itérations ou 90% de pass rate
6. Mettre à jour `evals/history.json` avec les résultats

---

## Étape 3 — Ce que tu regardes

À la fin, Claude ouvre un rapport avec :
- Le taux de réussite avant/après pour chaque assertion
- Les changements apportés au `SKILL.md`
- Les assertions qui restent difficiles (et pourquoi)

Tu valides ou tu demandes des ajustements manuels.

---

## Ajouter une nouvelle assertion

Si tu identifies un problème récurrent (ex: l'agent ne détecte pas un framework), ajoute un scénario dans `evals/evals.json` :

```json
{
  "id": 5,
  "prompt": "Décris la situation problématique exacte",
  "expected_output": "Ce que Claude devrait faire",
  "files": ["liste des fichiers présents dans le projet"],
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
- **Spécifique** — "L'agent exécute claude-retrofit" pas "L'agent gère bien les projets existants"
