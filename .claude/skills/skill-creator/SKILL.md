---
name: skill-creator
description: Moteur d'auto-amélioration des skills Claude Autopilot. Lance ce skill pour
  améliorer un skill existant : il grade chaque scénario d'eval, identifie les assertions
  qui échouent, réécrit le SKILL.md ciblé, et recommence jusqu'à 85% de pass rate.
  Déclenche sur : "améliore le skill X", "optimise autopilot-session", "le skill marche mal".
---

# Skill Creator — Moteur d'auto-amélioration

## Usage

Améliore le skill `<nom>` jusqu'à 85% de pass rate, max 5 itérations.

## Protocole

### Entrées
- Skill à améliorer : `.claude/skills/<nom>/SKILL.md`
- Evals : `.claude/skills/<nom>/evals/evals.json`
- History : `.claude/skills/<nom>/evals/history.json`

### Boucle (max 5 itérations)

**A — Grading**
Pour chaque scénario dans evals.json :
- Simuler : "Si Claude reçoit ce prompt avec ce SKILL.md en contexte, que fait-il ?"
- Grader chaque assertion : PASS ou FAIL + justification 1 ligne
- Calculer le pass rate global

Si pass rate >= 85% → arrêter la boucle.

**B — Analyse**
- Lister les assertions FAIL groupées par cause racine
- Identifier les 1-3 règles du SKILL.md responsables

**C — Réécriture ciblée**
- Modifier uniquement les sections responsables des échecs
- Ajouter des exemples concrets pour les assertions qui échouent
- Ne jamais supprimer une règle sauf si elle cause activement des échecs
- Formulation : impératif court, binaire, vérifiable

**D — Mettre à jour history.json**
```json
{
  "version": "vN",
  "parent": "vN-1",
  "timestamp": "<ISO date>",
  "expectation_pass_rate": 0.0,
  "grading_result": {
    "<scenario_id>": { "<assertion_index>": "PASS|FAIL" }
  },
  "changes": ["description courte"],
  "is_current_best": true
}
```
Mettre `is_current_best: false` sur toutes les versions précédentes.

---

## Rapport final

```
Skill : <nom>
Itérations : N
Pass rate : v0=X% → vFinal=Y%
Assertions encore en échec :
  - [scenario N] assertion : raison
```
