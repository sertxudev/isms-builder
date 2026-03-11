#!/usr/bin/env bash
# =============================================================================
# ISMS Builder — Version Bump Script
# Aktualisiert die Versionsnummer in allen relevanten Dateien.
#
# Verwendung:
#   bash scripts/bump-version.sh 1.30
#   bash scripts/bump-version.sh 1.30.1
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

NEW_VERSION="${1:-}"
if [[ -z "$NEW_VERSION" ]]; then
  echo "Verwendung: bash scripts/bump-version.sh <version>"
  echo "Beispiel:   bash scripts/bump-version.sh 1.30"
  exit 1
fi

# Kurze Version (z.B. 1.30) und volle Version (z.B. 1.30.0)
SHORT="${NEW_VERSION%.*}"
[[ "$NEW_VERSION" =~ \. ]] && SHORT_VER="$NEW_VERSION" || SHORT_VER="$NEW_VERSION"
FULL_VER="${NEW_VERSION}"
# Falls nur Major.Minor angegeben: .0 ergänzen für package.json
if [[ "${NEW_VERSION}" =~ ^[0-9]+\.[0-9]+$ ]]; then
  FULL_VER="${NEW_VERSION}.0"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }

# Aktuelle Version aus package.json lesen
OLD_FULL=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
OLD_SHORT=$(echo "$OLD_FULL" | sed 's/\.[0-9]*$//')

echo ""
echo "Version bump: ${OLD_FULL} → ${FULL_VER}"
echo ""

# 1. package.json
info "package.json..."
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
p.version = '${FULL_VER}';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
ok "package.json → ${FULL_VER}"

# 2. Copyright-Header in allen JS/HTML/CSS-Dateien
info "Copyright-Header in Quelldateien..."
COUNT=0
while IFS= read -r -d '' file; do
  if grep -q "ISMS Builder V ${OLD_SHORT}" "$file" 2>/dev/null; then
    sed -i "s/ISMS Builder V ${OLD_SHORT}/ISMS Builder V ${NEW_VERSION}/g" "$file"
    COUNT=$((COUNT + 1))
  fi
done < <(find server ui -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) -print0 2>/dev/null)
ok "${COUNT} Quelldateien aktualisiert"

# 3. README.md
info "README.md..."
sed -i "s/V 1\.[0-9][0-9]*/V ${NEW_VERSION}/g" README.md
sed -i "s/version-[0-9][0-9]*\.[0-9][0-9]*/version-${NEW_VERSION}/g" README.md
ok "README.md → V ${NEW_VERSION}"

# 4. CLAUDE.md (Projektdoku)
if grep -q "V 1\." CLAUDE.md 2>/dev/null; then
  sed -i "s/V 1\.[0-9][0-9]*/V ${NEW_VERSION}/g" CLAUDE.md
  ok "CLAUDE.md aktualisiert"
fi

echo ""
echo -e "${GREEN}Fertig! Version ist jetzt ${FULL_VER}${NC}"
echo ""
echo "Nächste Schritte:"
echo "  1. Änderungen prüfen: git diff"
echo "  2. npm test"
echo "  3. git add -A && git commit -m \"chore: bump version to ${FULL_VER}\""
echo "  4. Push + Tag: git tag v${FULL_VER} && git push origin main && git push origin v${FULL_VER}"
