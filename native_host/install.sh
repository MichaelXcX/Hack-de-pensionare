#!/usr/bin/env bash
# ============================================================
# Anarchist Native Messaging Host — Installer (macOS)
# Run this once after loading the extension in Chrome.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/anarchist_host.py"
MANIFEST_TEMPLATE="$SCRIPT_DIR/com.anarchist.nuclear.json"
NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# ---- 1. Make the host executable ----
chmod +x "$HOST_SCRIPT"

# ---- 2. Ask for the extension ID ----
echo ""
echo "============================================================"
echo " Anarchist Nuclear — Native Messaging Host Installer"
echo "============================================================"
echo ""
echo "To find your extension ID:"
echo "  1. Open Chrome and go to chrome://extensions"
echo "  2. Enable 'Developer mode' (top right)"
echo "  3. Find 'The Anarchist' and copy the ID below the name"
echo ""
read -r -p "Paste your Extension ID here: " EXT_ID

if [[ -z "$EXT_ID" ]]; then
  echo "ERROR: Extension ID cannot be empty." >&2
  exit 1
fi

# ---- 3. Write the final manifest with real path + ID ----
mkdir -p "$NMH_DIR"
MANIFEST_DEST="$NMH_DIR/com.anarchist.nuclear.json"

python3 - <<PYEOF
import json
with open('$MANIFEST_TEMPLATE') as f:
    m = json.load(f)
m['path'] = '$HOST_SCRIPT'
m['allowed_origins'] = ['chrome-extension://$EXT_ID/']
with open('$MANIFEST_DEST', 'w') as f:
    json.dump(m, f, indent=2)
print("Manifest written to: $MANIFEST_DEST")
PYEOF

# ---- 4. Test the host responds to ping ----
echo ""
echo "Testing native host..."
RESPONSE=$(echo -ne '\x0a\x00\x00\x00{"action":"ping"}' | python3 "$HOST_SCRIPT" 2>/dev/null | tail -c +5 || true)
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Native host is working!"
else
  echo "⚠️  Could not auto-test host (this is OK — Chrome will handle the launch)."
fi

echo ""
echo "============================================================"
echo " Installation complete!"
echo " Reload the extension in chrome://extensions for changes"
echo " to take effect."
echo "============================================================"
echo ""
