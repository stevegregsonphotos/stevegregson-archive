#!/bin/bash
# Steve Gregson Storage — Mac installer (free; no App Store needed).
#
#   curl -fsSL https://www.stevegregson.com/mac/install.sh | bash -s -- <code> [site]
#   curl -fsSL https://www.stevegregson.com/mac/install.sh | bash -s -- --uninstall
#
# Sets up:
#   ~/Steve Gregson Storage                 the folder that uploads to Storage
#   ~/Applications/Steve Gregson Storage    a Dock icon you can drop files on
#   a background uploader (launchd) that uploads within seconds and, 7 days
#   after a file has been uploaded and checked, removes the Mac copy.

set -eu

APP_NAME="Steve Gregson Storage"
LABEL="com.stevegregson.storage"
SUPPORT="$HOME/Library/Application Support/$APP_NAME"
ROOT="$HOME/$APP_NAME"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP="$HOME/Applications/$APP_NAME.app"
LOG="$HOME/Library/Logs/$APP_NAME.log"
DOMAIN="gui/$(id -u)"

say()  { printf '  %s\n' "$*"; }
done_() { printf '  \342\234\223 %s\n' "$*"; }
fail() { printf '\n  \342\234\227 %s\n\n' "$*" >&2; exit 1; }

[ "$(uname)" = "Darwin" ] || fail "This installer is for a Mac."

# ---- Icons ------------------------------------------------------------------
# Puts the Steve Gregson icon on the Dock app and the folder. Newer versions of
# macOS take an app's icon from Assets.car (the plain script icon), so that is
# removed first, otherwise the custom icon is ignored.
apply_icons() {
  ICONS="$SUPPORT/icons"
  rm -rf "$ICONS"; mkdir -p "$ICONS"
  if [ -d "$APP" ] && curl -fsSL --max-time 60 "$SERVER/mac/icon.png" -o "$ICONS/app.png" 2>/dev/null; then
    SET="$ICONS/app.iconset"; mkdir -p "$SET"
    for size in 16 32 128 256 512; do
      sips -z $size $size "$ICONS/app.png" --out "$SET/icon_${size}x${size}.png" >/dev/null 2>&1 || true
      sips -z $((size * 2)) $((size * 2)) "$ICONS/app.png" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "$SET" -o "$APP/Contents/Resources/applet.icns" >/dev/null 2>&1 || true
    rm -f "$APP/Contents/Resources/Assets.car"
    plutil -remove CFBundleIconName "$APP/Contents/Info.plist" >/dev/null 2>&1 || true
    plutil -replace CFBundleIconFile -string applet "$APP/Contents/Info.plist" >/dev/null 2>&1 || true
    # The app must stay validly signed after its icon changes (free, local signature).
    codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
    touch "$APP"
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
  fi
  if curl -fsSL --max-time 60 "$SERVER/mac/folder-icon.png" -o "$ICONS/folder.png" 2>/dev/null; then
    osascript -l JavaScript >/dev/null 2>&1 <<JXA || true
ObjC.import('AppKit');
var image = \$.NSImage.alloc.initWithContentsOfFile('$ICONS/folder.png');
\$.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, '$ROOT', 0);
JXA
  fi
}

# Adds the folder to Finder's sidebar (Favourites) once. Best effort: if this
# version of macOS doesn't allow it, the folder can be dragged there instead.
add_to_sidebar() {
  [ -f "$SUPPORT/.sidebar" ] && return 0
  if command -v sfltool >/dev/null 2>&1 \
    && sfltool add-item com.apple.LSSharedFileList.FavoriteItems "file://$(printf '%s' "$ROOT" | sed 's/ /%20/g')/" >/dev/null 2>&1; then
    touch "$SUPPORT/.sidebar"
  fi
  return 0
}

# ---- Uninstall --------------------------------------------------------------
if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  rm -rf "$APP" "$SUPPORT"
  security delete-generic-password -a "$USER" -s "$APP_NAME" >/dev/null 2>&1 || true
  echo
  done_ "$APP_NAME has been removed from this Mac."
  say "Your \"$APP_NAME\" folder and everything in it has been left where it is."
  say "If its icon is still in your Dock, drag it off the Dock to remove it."
  echo
  exit 0
fi

# ---- Update the uploader only (keeps the connection and settings) ----------
if [ "${1:-}" = "--update" ]; then
  SERVER="${2:-https://www.stevegregson.com}"; SERVER="${SERVER%/}"
  [ -f "$SUPPORT/agent.zsh" ] || fail "The Steve Gregson Storage app isn't installed on this Mac yet."
  for name in agent.zsh add.zsh; do
    curl -fsSL --max-time 60 "$SERVER/mac/$name" -o "$SUPPORT/$name.new" || fail "Couldn't download $name. Check you're online and try again."
    head -1 "$SUPPORT/$name.new" | grep -q '^#!/bin/zsh' || fail "The download didn't look right. Please try again."
    chmod 755 "$SUPPORT/$name.new"
    mv -f "$SUPPORT/$name.new" "$SUPPORT/$name"
  done
  # Stop a run that's still using the old version (anything half-sent is
  # simply sent again), then start the new one straight away.
  launchctl kill TERM "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
  sleep 3
  rmdir "$SUPPORT/lock" >/dev/null 2>&1 || true
  launchctl kickstart "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
  echo
  done_ "Updated ${APP_NAME}. From now on it keeps itself up to date."
  echo
  exit 0
fi

# ---- Refresh the icons only (no connection code needed) --------------------
if [ "${1:-}" = "--icon" ]; then
  SERVER="${2:-https://www.stevegregson.com}"; SERVER="${SERVER%/}"
  [ -d "$APP" ] || fail "The Steve Gregson Storage app isn't installed on this Mac yet."
  mkdir -p "$SUPPORT"
  apply_icons
  add_to_sidebar
  killall Dock >/dev/null 2>&1 || true
  killall Finder >/dev/null 2>&1 || true
  echo
  done_ "Updated the ${APP_NAME} icons"
  echo
  exit 0
fi

TOKEN="${1:-}"
SERVER="${2:-https://www.stevegregson.com}"
SERVER="${SERVER%/}"
case "$TOKEN" in
  sgm_*) ;;
  *) fail "The connection code is missing. Copy the whole line from Backstage › Storage › Mac app." ;;
esac

echo
say "Setting up ${APP_NAME}…"
echo

mkdir -p "$SUPPORT" "$ROOT" "$HOME/Library/LaunchAgents" "$HOME/Applications" "$HOME/Library/Logs"

# ---- Download the uploader ------------------------------------------------
fetch() {
  curl -fsSL --max-time 60 "$SERVER/mac/$1" -o "$SUPPORT/$1.new" || fail "Couldn't download $1 from $SERVER. Check you're online and try again."
  mv -f "$SUPPORT/$1.new" "$SUPPORT/$1"
}
fetch agent.zsh
fetch add.zsh
chmod 755 "$SUPPORT/agent.zsh" "$SUPPORT/add.zsh"
head -1 "$SUPPORT/agent.zsh" | grep -q '^#!/bin/zsh' || fail "The download didn't look right. Please try again."

# ---- Connect ----------------------------------------------------------------
security add-generic-password -U -a "$USER" -s "$APP_NAME" -l "$APP_NAME" -w "$TOKEN" >/dev/null 2>&1 \
  || fail "Couldn't save the connection code in your Keychain."
printf 'SERVER=%q\nOFFLOAD_DAYS=7\n' "$SERVER" > "$SUPPORT/config"

COMPUTER=$(scutil --get ComputerName 2>/dev/null | tr -d '"\\' || echo "Mac")
REPLY=$(curl -sS --max-time 30 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary "{\"action\":\"hello\",\"deviceName\":\"$COMPUTER\"}" "$SERVER/api/mac" 2>/dev/null || true)
OK=$(printf '%s' "$REPLY" | plutil -extract ok raw -o - - 2>/dev/null || true)
if [ "$OK" != "true" ]; then
  MESSAGE=$(printf '%s' "$REPLY" | plutil -extract message raw -o - - 2>/dev/null || true)
  fail "Couldn't connect to Storage${MESSAGE:+: $MESSAGE}. Make a new code in Backstage and try again."
fi
done_ "Connected \"$COMPUTER\" to Storage"

# ---- Dock icon (drop files on it) -----------------------------------------
rm -rf "$APP"
osacompile -o "$APP" >/dev/null 2>&1 <<'APPLESCRIPT' || fail "Couldn't create the Dock app."
property appName : "Steve Gregson Storage"

on open droppedItems
	set helper to (POSIX path of (path to home folder)) & "Library/Application Support/Steve Gregson Storage/add.zsh"
	set args to ""
	repeat with anItem in droppedItems
		set args to args & " " & quoted form of (POSIX path of anItem)
	end repeat
	try
		set summary to do shell script "/bin/zsh " & quoted form of helper & args
		display notification summary with title appName
	on error errMsg
		display dialog errMsg buttons {"OK"} default button 1 with title appName with icon caution
	end try
end open

on run
	do shell script "open " & quoted form of ((POSIX path of (path to home folder)) & "Steve Gregson Storage")
end run
APPLESCRIPT

apply_icons
add_to_sidebar
done_ "Created the \"$APP_NAME\" folder in your Home folder"

# Add to the Dock once.
if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -q "$APP_NAME.app"; then
  APP_URL="file://$(printf '%s' "$APP" | sed 's/ /%20/g')/"
  defaults write com.apple.dock persistent-apps -array-add \
    "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$APP_URL</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>" \
    && killall Dock >/dev/null 2>&1 || true
fi
killall Dock >/dev/null 2>&1 || true
done_ "Added the $APP_NAME icon to your Dock"

# ---- Background uploader ----------------------------------------------------
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$SUPPORT/agent.zsh</string></array>
  <key>WatchPaths</key><array><string>$ROOT</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null || fail "Couldn't set up the background uploader."
launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST" || fail "Couldn't start the background uploader."
done_ "Started the background uploader"

echo
say "All set. Put files in the \"$APP_NAME\" folder or drop them on the Dock icon."
say "They upload straight away; 7 days later the Mac copy is removed once Storage"
say "has been checked to hold an exact copy."
echo
open "$ROOT" >/dev/null 2>&1 || true
