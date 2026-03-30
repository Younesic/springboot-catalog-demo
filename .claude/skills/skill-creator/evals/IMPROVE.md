# ♻️ Auto-amélioration du skill skill-creator

## C'est quoi

Un loop qui teste automatiquement le moteur contre les 5 scénarios de `evals/evals.json`,
identifie quelles règles du protocole échouent, modifie le `SKILL.md`, et recommence.

Note : skill-creator s'améliore lui-même — utilise un autre agent ou une session fraîche
pour éviter les biais de confirmation.

---

## Quand le lancer

- Quand l'agent ne grade pas toutes les assertions (saute des scénarios)
- Quand l'agent modifie tout le SKILL.md au lieu des sections ciblées
- Quand history.json n'est pas mis à jour correctement après une itération
- Quand l'agent ne s'arrête pas à 5 itérations ou au seuil de 85%

---

## Lancer depuis Claude Code

```
Améliore le skill skill-creator en utilisant le skill-creator.
Les evals sont dans .claude/skills/skill-creator/evals/evals.json.
Lance jusqu'à 5 itérations ou jusqu'à 90% de pass rate.
```

---

## Règle d'or pour les assertions

- **Binaire** — vrai ou faux
- **Observable** — vérifiable en lisant la réponse
- **Spécifique** — "L'agent grade chaque assertion" pas "L'agent fait bien son travail"
