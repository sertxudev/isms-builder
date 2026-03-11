#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ISMS Builder – ISO Controls Import Script
# Version: 1.30
#
# PURPOSE:
#   Imports ISO 27001:2022, ISO 9000:2015, or ISO 9001:2015 control definitions
#   into the ISMS Builder data directory.
#
#   ISO standards are copyright-protected by ISO. The ISMS Builder does NOT
#   include ISO control text in its distribution. You must provide your own
#   JSON file based on your licensed copy of the standard.
#
# USAGE:
#   ./scripts/import-iso-controls.sh <json-file> [data-dir]
#
# ARGUMENTS:
#   json-file   Path to a JSON file containing an array of control objects.
#               Each object must have these fields:
#                 - id        (string) e.g. "ISO-5.1"
#                 - theme     (string) e.g. "Organizational"
#                 - title     (string) e.g. "Policies for information security"
#                 - framework (string) one of: "ISO27001", "ISO9000", "ISO9001"
#   data-dir    Optional. Path to ISMS Builder data directory. Default: ./data
#
# EXAMPLE JSON FORMAT:
#   [
#     { "id": "ISO-5.1", "theme": "Organizational", "title": "Policies for information security", "framework": "ISO27001" },
#     { "id": "ISO-5.2", "theme": "Organizational", "title": "Information security roles", "framework": "ISO27001" }
#   ]
#
# AFTER IMPORT:
#   Restart the ISMS Builder server for changes to take effect:
#     npm start        (or: bash start.sh)
#
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

JSON_FILE="${1:-}"
DATA_DIR="${2:-./data}"
ISO_FILE="$DATA_DIR/iso-controls.json"

if [[ -z "$JSON_FILE" ]]; then
  echo "ERROR: No JSON file specified." >&2
  echo "Usage: $0 <json-file> [data-dir]" >&2
  exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
  echo "ERROR: File not found: $JSON_FILE" >&2
  exit 1
fi

if [[ ! -d "$DATA_DIR" ]]; then
  echo "ERROR: Data directory not found: $DATA_DIR" >&2
  echo "Make sure you are running this script from the ISMS Builder root directory." >&2
  exit 1
fi

# Validate JSON (requires python3 or jq)
if command -v python3 &>/dev/null; then
  COUNT=$(python3 -c "import json,sys; d=json.load(open('$JSON_FILE')); print(len(d))" 2>/dev/null || echo "ERROR")
elif command -v jq &>/dev/null; then
  COUNT=$(jq 'length' "$JSON_FILE" 2>/dev/null || echo "ERROR")
else
  COUNT="unknown"
fi

if [[ "$COUNT" == "ERROR" ]]; then
  echo "ERROR: $JSON_FILE does not contain valid JSON." >&2
  exit 1
fi

cp "$JSON_FILE" "$ISO_FILE"
echo "Imported $COUNT ISO control(s) to $ISO_FILE"
echo ""
echo "-> Restart the ISMS Builder server for the controls to appear in SoA:"
echo "    bash start.sh   (or: npm start)"
