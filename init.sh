#!/usr/bin/env bash
# ── Lancé par Claude au début de chaque session ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 État du projet — $(date '+%Y-%m-%d %H:%M')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "── Progress ──"
cat claude-progress.txt 2>/dev/null || echo "(pas de fichier progress)"
echo ""

echo "── Git log (5 derniers commits) ──"
git log --oneline -5 2>/dev/null || echo "(pas de git)"
echo ""

echo "── Fichiers modifiés non commités ──"
git status --short 2>/dev/null || echo "(rien)"
echo ""

echo "── Features en attente ──"
python3 -c "
import json
try:
  data = json.load(open('feature_list.json'))
  todo = [f for f in data['features'] if not f['passes']]
  done = [f for f in data['features'] if f['passes']]
  for f in todo[:5]:
    print(f'  [{f[\"id\"]}] P{f[\"priority\"]} — {f[\"description\"]}')
  if len(todo) > 5:
    print(f'  ... et {len(todo)-5} autres')
  print(f'  Progression : {len(done)}/{len(data[\"features\"])} features')
except: print('  (feature_list.json non trouvé)')
" 2>/dev/null || echo "  (python3 non disponible)"

echo ""
echo "── Derniers checkpoints ──"
if [ -f ".claude/checkpoints/session.log" ]; then
  tail -3 .claude/checkpoints/session.log
else
  echo "  (aucun checkpoint cette session)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 Pour re-ancrer après compaction : cat REANCHOR.md"
echo "⏱️  Pour sauvegarder l'état : bash claude-checkpoint.sh 'message'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Prêt. Quelle feature traiter ?"
