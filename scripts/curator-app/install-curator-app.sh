#!/bin/bash
# Builds "Curate Production.app" in your Applications folder.
# Run once (and again if you move this website folder):
#   npm run curator:install-app
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This installer only works on a Mac."
  exit 1
fi

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$HOME/Applications"
APP="$APP_DIR/Curate Production.app"

# Make the folder path safe to put inside an AppleScript string.
ESCAPED="${REPO//\\/\\\\}"
ESCAPED="${ESCAPED//\"/\\\"}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/curate.applescript" <<APPLESCRIPT
-- Curate Production: opens Terminal and runs Steve's production curator.
set repoPath to "$ESCAPED"
try
	do shell script "test -d " & quoted form of repoPath
on error
	display dialog "The website folder can't be found:" & return & repoPath & return & return & "If you moved it, run 'npm run curator:install-app' again from its new place." buttons {"OK"} default button "OK" with title "Curate Production"
	return
end try
tell application "Terminal"
	activate
	do script "cd " & quoted form of repoPath & " && clear && npm run --silent curate; echo; echo 'You can close this window.'"
end tell
APPLESCRIPT

mkdir -p "$APP_DIR"
if [[ -d "$APP" ]]; then
  rm -rf "$APP"
fi
osacompile -o "$APP" "$TMP/curate.applescript"

echo
echo "Installed: $APP"
echo "Tip: drag it from the Finder window that just opened into your Dock."
open -R "$APP"
