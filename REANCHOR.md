# ⚓ REANCHOR — Règles essentielles (relis après compaction)

> Ce fichier existe pour une raison : tu viens de traverser une compaction ou une longue session.
> Relis ces 5 règles, puis reprends le travail.

## Les 5 règles qui ne changent jamais

1. **UNE tâche à la fois** — termine avant de commencer la suivante
2. **Lis avant d'écrire** — ne te souviens pas du code, lis le fichier actuel
3. **Checkpoint régulier** — `bash claude-checkpoint.sh "message"` après chaque étape
4. **Pas de feature "done" sans test** — vérifie end-to-end avant de marquer passes: true
5. **Si incertain → dis-le** — jamais de confabulation, jamais d'invention

## Reprendre après compaction

```bash
cat claude-progress.txt      # État actuel
git log --oneline -5         # Derniers commits
cat feature_list.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
todo=[f for f in d['features'] if not f['passes']]
[print(f'  [{f[\"id\"]}] {f[\"description\"]}') for f in todo[:3]]
print(f'  ... {len(todo)} restante(s)')
" 2>/dev/null
```

## Tâche en cours
<!-- Claude met à jour cette ligne via claude-checkpoint.sh -->
Voir `claude-progress.txt` section "En cours"
