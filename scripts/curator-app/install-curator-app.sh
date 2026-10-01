#!/bin/bash
# Builds "Curate Production.app" (with its icon) in your Applications folder.
# Run once (and again if you move this website folder):
#   npm run curator:install-app
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This installer only works on a Mac."
  exit 1
fi

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="Curate Production.app"
ICON_SRC="$REPO/scripts/curator-app/icon-1024.png"

# Prefer the main Applications folder; fall back to the personal one if
# this Mac account can't write there.
if [[ -w "/Applications" ]]; then
  APP_DIR="/Applications"
else
  APP_DIR="$HOME/Applications"
fi
APP="$APP_DIR/$APP_NAME"

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

# Give the app the SG spotlight icon.
if [[ -f "$ICON_SRC" ]]; then
  ICONSET="$TMP/Curate.iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns -o "$TMP/Curate.icns" "$ICONSET"
  cp "$TMP/Curate.icns" "$APP/Contents/Resources/applet.icns"
  # Newer macOS shows a default icon baked into the app, so also set the
  # icon the way Finder's Get Info does; this reliably wins.
  ICON_SRC="$ICON_SRC" APP="$APP" osascript -l JavaScript -e '
    ObjC.import("AppKit");
    const env = $.NSProcessInfo.processInfo.environment;
    const image = $.NSImage.alloc.initWithContentsOfFile(env.objectForKey("ICON_SRC"));
    $.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, env.objectForKey("APP"), 0);
  ' >/dev/null || echo "Note: couldn't set the app icon; the app still works."
  touch "$APP"
  killall Dock 2>/dev/null || true
fi

# Remove an older copy from the personal Applications folder, so there's
# only ever one Curate Production.
OLD="$HOME/Applications/$APP_NAME"
if [[ "$APP_DIR" != "$HOME/Applications" && -d "$OLD" ]]; then
  rm -rf "$OLD"
  echo "Removed the older copy from your personal Applications folder."
fi

echo
echo "Installed: $APP"
echo "Tip: drag it from the Finder window that just opened into your Dock."
open -R "$APP"
