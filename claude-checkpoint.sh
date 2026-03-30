#!/usr/bin/env bash
# ============================================================
# claude-checkpoint.sh — Sauvegarde d'état mid-session
# Usage : bash claude-checkpoint.sh "description de l'étape"
# Appelé par Claude toutes les ~15 actions ou après chaque sous-tâche
# ============================================================

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MESSAGE="${1:-checkpoint automatique}"
PROGRESS_FILE="claude-progress.txt"
CHECKPOINT_DIR=".claude/checkpoints"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── 1. Créer le répertoire checkpoints si besoin ─────────────
mkdir -p "$CHECKPOINT_DIR"

# ─── 2. Snapshot git (sans commit forcé) ──────────────────────
GIT_STATUS=$(git status --short 2>/dev/null | head -10)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
MODIFIED_FILES=$(git diff --name-only 2>/dev/null | head -5)

# ─── 3. Écrire le checkpoint ──────────────────────────────────
CHECKPOINT_FILE="$CHECKPOINT_DIR/cp-$(date '+%Y%m%d-%H%M%S').json"

cat > "$CHECKPOINT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "message": "$MESSAGE",
  "git_hash": "$GIT_HASH",
  "modified_files": $(echo "$MODIFIED_FILES" | python3 -c "import sys,json; lines=[l.strip() for l in sys.stdin if l.strip()]; print(json.dumps(lines))" 2>/dev/null || echo "[]"),
  "git_status": $(echo "$GIT_STATUS" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" 2>/dev/null || echo "\"\"")
}
EOF

# ─── 4. Mettre à jour REANCHOR.md avec la tâche en cours ─────
if [ -f "REANCHOR.md" ]; then
  if command -v python3 &>/dev/null; then
    ESCAPED_MSG=$(printf '%s' "$MESSAGE" | sed "s/'/\\\\''/g")
    ESCAPED_TS=$(printf '%s' "$TIMESTAMP" | sed "s/'/\\\\''/g")
    python3 -c "
import re, sys
msg = '$ESCAPED_MSG'
ts  = '$ESCAPED_TS'
with open('REANCHOR.md', 'r') as f:
    content = f.read()
new_line = '**En cours** : ' + msg + ' — checkpoint ' + ts
content = re.sub(r'Voir \x60claude-progress\.txt\x60.*|^\*\*En cours\*\*.*', new_line, content, flags=re.MULTILINE)
with open('REANCHOR.md', 'w') as f:
    f.write(content)
" 2>/dev/null
  fi
fi

# ─── 5. Ajouter une entrée dans claude-progress.txt ──────────
if [ -f "$PROGRESS_FILE" ]; then
  echo "" >> "$PROGRESS_FILE"
  echo "[$TIMESTAMP] ⏱️ CHECKPOINT — $MESSAGE (git: $GIT_HASH)" >> "$PROGRESS_FILE"
fi

# ─── 5b. Écrire dans session.log ──────────────────────────────
echo "[$TIMESTAMP] ⏱️ CHECKPOINT — $MESSAGE (git: $GIT_HASH)" >> "$CHECKPOINT_DIR/session.log"

# ─── 6. Auto-commit si des fichiers sont modifiés ─────────────
if [ -n "$MODIFIED_FILES" ] && [ "${AUTO_COMMIT:-false}" = "true" ]; then
  git add -A 2>/dev/null
  git commit -m "checkpoint: $MESSAGE" 2>/dev/null && \
    echo -e "${GREEN}✓ Auto-commit créé${NC}"
fi

# ─── 7. Résumé ────────────────────────────────────────────────
echo -e "${BLUE}⏱️ Checkpoint sauvegardé${NC} — $MESSAGE"
echo -e "   Git hash    : $GIT_HASH"
echo -e "   Fichier     : $CHECKPOINT_FILE"
if [ -n "$MODIFIED_FILES" ]; then
  echo -e "   Modifiés    :"
  echo "$MODIFIED_FILES" | while read -r f; do echo "     - $f"; done
fi

# ─── 8. Avertissement contexte ────────────────────────────────
# Compter les checkpoints de la session pour estimer l'utilisation
CP_COUNT=$(ls "$CHECKPOINT_DIR"/cp-*.json 2>/dev/null | wc -l)
if [ "$CP_COUNT" -ge 8 ]; then
  echo ""
  echo -e "  ⚠️  ${CP_COUNT} checkpoints cette session."
  echo -e "  → Pense à terminer la session proprement bientôt."
  echo -e "  → Si compaction imminente : relis REANCHOR.md après."
fi
