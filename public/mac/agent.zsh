#!/bin/zsh
# Steve Gregson Storage — Mac uploader.
#
# Runs in the background (launchd) every few minutes and whenever the
# Storage folder changes:
#   1. uploads new or changed files from ~/Steve Gregson Storage, several at
#      once (UPLOAD_JOBS, default 8) so big batches use the full connection
#   2. after OFFLOAD_DAYS, asks Storage to confirm it holds an exact copy
#      (same size and MD5 fingerprint) and only then removes the Mac copy.
#   3. Finder right-click (Quick Actions) on anything in the Storage folder:
#      "Bring back from Storage" (downloads cleared files back into place)
#      and "Clear from Mac now" (clears straight away, after the same check).
#      Those call `agent.zsh --request <bring-back|clear-now> <paths…>`,
#      which queues the request and starts a run.
#   4. Progress: writes status.json in the support folder (read by the
#      menu bar icon) and sends the same report to Backstage › Storage.
# Nothing in Storage is ever deleted from here.

emulate -L zsh
SCRIPT_PATH=${0:A}   # this file (inside functions $0 is the function name)
setopt pipefail no_nomatch

APP_NAME="Steve Gregson Storage"
SUPPORT="${SGS_SUPPORT:-$HOME/Library/Application Support/$APP_NAME}"
ROOT="${SGS_ROOT:-$HOME/$APP_NAME}"
LOG="${SGS_LOG:-$HOME/Library/Logs/$APP_NAME.log}"
STATE="$SUPPORT/state.tsv"
CONFIG="$SUPPORT/config"
LOCK="$SUPPORT/lock"
MAX_BYTES=$((5 * 1024 * 1024 * 1024))
SETTLE_SECONDS=${SGS_SETTLE_SECONDS:-30}
KEEP_FREE_GB=${SGS_KEEP_FREE_GB:-30}   # "Bring back" never leaves less free than this
NOW=${SGS_NOW:-$(date +%s)}

SERVER=""
OFFLOAD_DAYS=7
UPLOAD_JOBS=8          # files uploaded at the same time
[[ -f "$CONFIG" ]] && source "$CONFIG"
[[ -n "$SGS_UPLOAD_JOBS" ]] && UPLOAD_JOBS=$SGS_UPLOAD_JOBS
[[ "$UPLOAD_JOBS" == <-> ]] && (( UPLOAD_JOBS >= 1 && UPLOAD_JOBS <= 32 )) || UPLOAD_JOBS=8
# Never clear files from the Mac sooner than 1 day after upload (a 0 here
# once cleared Steve's exports within minutes, before he could edit them).
OFFLOAD_SET="$OFFLOAD_DAYS"
[[ "$OFFLOAD_DAYS" == <-> ]] && (( OFFLOAD_DAYS >= 1 )) || OFFLOAD_DAYS=2

mkdir -p "$SUPPORT" "${LOG:h}"
touch "$STATE"

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG"; }

notify() {
  [[ -n "$SGS_NO_NOTIFY" ]] && return
  local text="${1//\"/\\\"}"
  osascript -e "display notification \"$text\" with title \"$APP_NAME\"" >/dev/null 2>&1
}

human() {
  local b=$1
  if (( b >= 1073741824 )); then printf "%.1f GB" $(( b / 1073741824.0 ))
  elif (( b >= 1048576 )); then printf "%.0f MB" $(( b / 1048576.0 ))
  else printf "%d KB" $(( (b + 1023) / 1024 )); fi
}

token() {
  if [[ -n "$SGS_TOKEN" ]]; then print -r -- "$SGS_TOKEN"; return; fi
  security find-generic-password -a "$USER" -s "$APP_NAME" -w 2>/dev/null
}

# ---- Right-click requests from Finder (Quick Actions) -------------------
REQ="$SUPPORT/requests"
if [[ "$1" == "--request" ]]; then
  kind="$2"; shift 2
  [[ "$kind" == bring-back || "$kind" == clear-now || "$kind" == tidy-report || "$kind" == tidy-apply ]] || exit 0
  n=0
  for f in "$@"; do
    f="${f%/}"
    if [[ "$kind" == tidy-* && "$f" == "$ROOT" ]]; then
      print -r -- "$kind"$'\t'"ALL" >> "$REQ"; (( n++ )); continue
    fi
    [[ "$f" == "$ROOT"/* ]] || continue
    print -r -- "$kind"$'\t'"${f#$ROOT/}" >> "$REQ"
    (( n++ ))
  done
  if (( n == 0 )); then
    notify "Choose a folder or file inside the $APP_NAME folder."
    exit 0
  fi
  if [[ "$kind" == tidy-* ]]; then
    notify "Checking Storage for leftover copies… you'll get a message when it's done."
  elif [[ "$kind" == bring-back ]]; then
    notify "Bringing back from Storage… you'll get a message when it's done."
  else
    notify "Clearing from this Mac (each file is checked in Storage first)…"
  fi
  launchctl kickstart "gui/$(id -u)/com.stevegregson.storage" >/dev/null 2>&1
  exit 0
fi

# ---- Pause / resume (menu bar icon, Backstage, or Terminal) -------------
# `agent.zsh --pause-until <epoch>` (0 = until resumed) stops uploads straight
# away so the connection is free (e.g. to send a transfer); `--resume` starts
# them again. While paused, a small watcher (`--pause-watch`) checks every
# minute whether the time is up or Resume was pressed in Backstage.
PAUSE_FILE="$SUPPORT/paused"
WATCH_PID="$SUPPORT/pause-watch.pid"
UPLOADER="gui/$(id -u)/com.stevegregson.storage"

pause_until() { [[ -f "$PAUSE_FILE" ]] && { local u; u=$(<"$PAUSE_FILE"); [[ "$u" == <-> ]] && print -r -- "$u" || print 0; } }
# True while paused (removes an expired pause).
is_paused() {
  [[ -f "$PAUSE_FILE" ]] || return 1
  local u; u=$(pause_until)
  if (( u > 0 && u <= $(date +%s) )); then
    rm -f "$PAUSE_FILE"; log "Pause ended; uploads starting again."
    return 1
  fi
  return 0
}
stop_current_run() {
  launchctl kill TERM "$UPLOADER" >/dev/null 2>&1
  # Uploads/downloads in progress (only this app's curl uses this time limit).
  pkill -f -- "--max-time 21600" >/dev/null 2>&1
  sleep 1
  rmdir "$SUPPORT/lock" 2>/dev/null
}
pause_text() {
  local u=$1
  (( u == 0 )) && { print "until you resume"; return; }
  if [[ "$(date -r "$u" +%F)" == "$(date +%F)" ]]; then print "until $(date -r "$u" +%H:%M)"
  else print "until $(date -r "$u" '+%a %H:%M')"; fi
}

if [[ "$1" == "--pause-until" ]]; then
  u="${2:-0}"; [[ "$u" == <-> ]] || u=0
  print -r -- "$u" > "$PAUSE_FILE"
  log "Uploads paused $(pause_text $u)."
  stop_current_run
  # A fresh run sees the pause, reports it and starts the watcher.
  launchctl kickstart "$UPLOADER" >/dev/null 2>&1
  notify "Uploads paused $(pause_text $u). Anything half-sent will be sent again when they restart."
  exit 0
fi
if [[ "$1" == "--resume" ]]; then
  if [[ -f "$PAUSE_FILE" ]]; then
    rm -f "$PAUSE_FILE"
    log "Uploads resumed${2:+ ($2)}."
    notify "Uploads started again${2:+ ($2)}."
  fi
  [[ -f "$WATCH_PID" ]] && { kill "$(<"$WATCH_PID")" 2>/dev/null; rm -f "$WATCH_PID"; }
  launchctl kickstart "$UPLOADER" >/dev/null 2>&1
  exit 0
fi
if [[ "$1" == "--pause-watch" ]]; then
  setopt extended_glob
  print -r -- $$ > "$WATCH_PID"
  trap '[[ "$(<"$WATCH_PID" 2>/dev/null)" == "$$" ]] && rm -f "$WATCH_PID"' EXIT
  tok=$(token)
  while [[ -f "$PAUSE_FILE" ]]; do
    if ! is_paused; then
      launchctl kickstart "$UPLOADER" >/dev/null 2>&1
      notify "Pause over: uploads started again."
      exit 0
    fi
    # Resume pressed in Backstage? (also tells Backstage the Mac is still here)
    if [[ -n "$SERVER" && -n "$tok" ]]; then
      reply=$(curl -sS --max-time 20 -H "Authorization: Bearer $tok" -H "Content-Type: application/json" \
        -d '{"action":"pause-check"}' "$SERVER/api/mac" 2>/dev/null)
      if [[ "$reply" == *'"resume":true'* ]]; then
        rm -f "$PAUSE_FILE"; log "Uploads resumed (from Backstage)."
        notify "Uploads started again (from Backstage)."
        launchctl kickstart "$UPLOADER" >/dev/null 2>&1
        exit 0
      fi
    fi
    # Keep the menu bar icon's report fresh so it doesn't look stuck.
    if [[ -f "$SUPPORT/status.json" ]]; then
      s=$(<"$SUPPORT/status.json")
      s=${s/\"updated\":[0-9]##/"\"updated\":$(date +%s)"}
      print -r -- "$s" > "$SUPPORT/status.json.tmp" && mv -f "$SUPPORT/status.json.tmp" "$SUPPORT/status.json"
    fi
    sleep ${SGS_WATCH_SECONDS:-60}
  done
  exit 0
fi

# One run at a time (the Dock icon can start a run while one is going).
if ! mkdir "$LOCK" 2>/dev/null; then
  if [[ -n $(find "$LOCK" -maxdepth 0 -mmin +240 2>/dev/null) ]]; then
    rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" 2>/dev/null || exit 0
  else
    exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
# A long upload run touches the lock as it goes, so it is never mistaken for
# a stuck run (stuck = untouched for 4 hours).

TOKEN=$(token)
if [[ -z "$SERVER" || -z "$TOKEN" ]]; then
  log "Not set up: missing server or connection code."
  exit 0
fi
[[ -d "$ROOT" ]] || mkdir -p "$ROOT"

DEVICE_NAME=$(scutil --get ComputerName 2>/dev/null || hostname)

json_escape() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  print -r -- "$s"
}

# POST {action, ...} to the website; prints the JSON reply.
api() {
  local body="$1"
  curl -sS --max-time 60 --retry 2 \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$body" \
    "$SERVER/api/mac"
}

# Read one value from a JSON reply (plutil is built into macOS).
jget() {
  print -r -- "$1" | plutil -extract "$2" raw -o - - 2>/dev/null
}

file_info() { stat -f '%z %m %c' "$1" 2>/dev/null; }   # size, modified, changed
md5_of() { md5 -q "$1" 2>/dev/null; }

# ---- Progress report ------------------------------------------------------
# status.json is read by the menu bar icon every couple of seconds; the same
# report goes to Backstage › Storage › Mac app (at most every 15 seconds).
zmodload zsh/datetime
zmodload -F zsh/stat b:zstat     # fast file sizes/dates (no extra process per file)
STATUS_FILE="$SUPPORT/status.json"
RUN_STARTED=$EPOCHSECONDS
STATUS_STATE="checking"
plan_files=0; plan_bytes=0; checked=0
down_files=0; down_bytes=0; down_f0=0; down_b0=0   # "Bring back" progress
uploaded=0; uploaded_bytes=0; freed=0; freed_bytes=0; failed=0; pending=0
onmac_files=0; onmac_bytes=0; next_clear=0
last_status_write=0; last_status_send=0
PAUSED=false; PAUSED_UNTIL=0
typeset -a too_big RECENT        # RECENT: "epoch<TAB>path", newest last
typeset -A JOB_REL
typeset -A BUSY          # folder -> files in it still to upload (for Backstage's "still updating" warning)

# Files uploaded but still on this Mac, and when the next one is due to clear.
onmac_stats() {
  local rel due
  onmac_files=0; onmac_bytes=0; next_clear=0
  for rel in ${(k)S_SIZE}; do
    [[ -f "$ROOT/$rel" ]] || continue
    (( onmac_files++ ))
    (( onmac_bytes += ${S_SIZE[$rel]:-0} ))
    due=$(( ${S_AT[$rel]:-0} + OFFLOAD_DAYS * 86400 ))
    (( next_clear == 0 || due < next_clear )) && next_clear=$due
  done
}

# Writes the report; "now" also sends it to the website straight away.
write_status() {
  local now=$EPOCHSECONDS cur="" rec="" sep="" n entry body
  [[ "$1" != now ]] && (( now - last_status_write < 1 )) && return
  last_status_write=$now
  for n in ${(k)JOB_REL}; do cur+="$sep\"$(json_escape "${JOB_REL[$n]}")\""; sep=","; done
  sep=""
  for entry in $RECENT; do
    rec+="$sep{\"at\":${entry%%$'\t'*},\"path\":\"$(json_escape "${entry#*$'\t'}")\"}"; sep=","
  done
  body="{\"v\":1,\"state\":\"$STATUS_STATE\",\"updated\":$now,\"runStarted\":$RUN_STARTED"
  body+=",\"total\":{\"files\":$plan_files,\"bytes\":$plan_bytes},\"done\":{\"files\":$uploaded,\"bytes\":$uploaded_bytes}"
  body+=",\"checked\":$checked,\"failed\":$failed,\"waiting\":${pending:-0},\"tooBig\":${#too_big},\"current\":[$cur],\"recent\":[$rec]"
  body+=",\"onMac\":{\"files\":$onmac_files,\"bytes\":$onmac_bytes},\"nextClear\":$next_clear,\"offloadDays\":$OFFLOAD_DAYS"
  body+=",\"down\":{\"files\":$down_files,\"bytes\":$down_bytes,\"doneFiles\":$(( fetched - down_f0 )),\"doneBytes\":$(( fetched_bytes - down_b0 ))}"
  body+=",\"paused\":$PAUSED,\"pausedUntil\":$PAUSED_UNTIL"
  # Folders with changes still waiting to reach Storage, so Backstage can
  # warn before Steve sends one of them to a client.
  local bf="" bsep="" bd
  for bd in ${(k)BUSY}; do bf+="$bsep{\"path\":\"$(json_escape "$bd")\",\"files\":${BUSY[$bd]}}"; bsep=","; done
  body+=",\"busyFolders\":[$bf]"
  body+=",\"freed\":{\"files\":$freed,\"bytes\":$freed_bytes},\"server\":\"$(json_escape "$SERVER")\"}"
  print -r -- "$body" > "$STATUS_FILE.tmp" && mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
  if [[ "$1" == now ]] || (( now - last_status_send >= 15 )); then
    last_status_send=$now
    [[ -z "$SGS_NO_STATUS_SEND" ]] && { api "{\"action\":\"status\",\"status\":$body}" >/dev/null 2>&1 &! }
  fi
}

# Updates just the state of the last report (e.g. offline), keeping the rest.
mark_status() {
  setopt local_options extended_glob
  [[ -f "$STATUS_FILE" ]] || return
  local s
  s=$(<"$STATUS_FILE")
  s=${s/\"state\":\"[a-z]##\"/"\"state\":\"$1\""}
  s=${s/\"updated\":[0-9]##/"\"updated\":$EPOCHSECONDS"}
  s=${s/\"current\":\[[^\]]#\]/"\"current\":[]"}
  print -r -- "$s" > "$STATUS_FILE.tmp" && mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
}

# ---- State: one line per uploaded file --------------------------------
# relative path <TAB> size <TAB> modified <TAB> md5 <TAB> uploaded (epoch) <TAB> storage path
typeset -A S_SIZE S_MTIME S_MD5 S_AT S_REMOTE
while IFS=$'\t' read -r rel size mtime md5 at remote; do
  [[ -z "$rel" ]] && continue
  S_SIZE[$rel]=$size; S_MTIME[$rel]=$mtime; S_MD5[$rel]=$md5; S_AT[$rel]=$at; S_REMOTE[$rel]=$remote
done < "$STATE"

# ---- History: what this Mac has ever put in Storage, and what it cleared ---
# One Storage path per line. Used to spot old copies left behind by renames:
# a file in Storage that this Mac uploaded, that isn't on the Mac any more
# and that the app didn't clear to save space. Started from the log once.
HISTORY="$SUPPORT/uploaded-paths.txt"
CLEARED="$SUPPORT/cleared-paths.txt"
typeset -A TOUCHED      # folders where something was uploaded or renamed this run
typeset -A GONE_BY_KEY  # "size:md5" -> old Mac path, for spotting renames
typeset -A DIRMAP       # old folder -> new folder, when a whole folder was renamed/moved
moved=0
if [[ ! -f "$SUPPORT/history-from-log" ]]; then
  if [[ -f "$LOG" ]]; then
    {
      grep -F '  Uploaded ' "$LOG" | grep -v ' but it changed while uploading' \
        | sed -E 's/^[0-9-]+ [0-9:]+  Uploaded //; s/^.* as (.*) \(a different file already had that name\)$/\1/'
      grep -E '  Brought back .* from Storage\.$' "$LOG" | sed -E 's/^[0-9-]+ [0-9:]+  Brought back //; s/ from Storage\.$//'
    } >> "$HISTORY" 2>/dev/null
    {
      grep -F '  Freed space: ' "$LOG" | sed -E 's/^[0-9-]+ [0-9:]+  Freed space: //; s/ is now only in Storage \(.*\)\.$//'
      grep -F '  Freed space: ' "$LOG" | sed -E 's/^.* is now only in Storage \((.*)\)\.$/\1/'
    } >> "$CLEARED" 2>/dev/null
  fi
  touch "$HISTORY" "$CLEARED" "$SUPPORT/history-from-log"
fi

save_state() {
  local tmp="$STATE.tmp" rel
  {
    for rel in ${(k)S_SIZE}; do
      print -r -- "$rel"$'\t'"${S_SIZE[$rel]}"$'\t'"${S_MTIME[$rel]}"$'\t'"${S_MD5[$rel]}"$'\t'"${S_AT[$rel]}"$'\t'"${S_REMOTE[$rel]}"
    done
  } > "$tmp"
  mv -f "$tmp" "$STATE"
}

forget() {
  unset "S_SIZE[$1]" "S_MTIME[$1]" "S_MD5[$1]" "S_AT[$1]" "S_REMOTE[$1]"
}

# ---- Check the connection ---------------------------------------------
reply=$(api "{\"action\":\"hello\",\"deviceName\":\"$(json_escape "$DEVICE_NAME")\"}")
if [[ "$(jget "$reply" ok)" != "true" ]]; then
  if [[ "$(jget "$reply" code)" == "not_connected" ]]; then
    log "This Mac has been disconnected in Backstage; nothing uploaded."
    mark_status disconnected
  else
    log "Couldn't reach $SERVER (offline?). Will try again later."
    mark_status offline
  fi
  exit 0
fi

# ---- Keep up to date (once a day; the new version runs next time) -------
self_update() {
  local marker="$SUPPORT/.checked-for-update" name tmp
  [[ -f "$marker" && -z $(find "$marker" -mmin +1440 2>/dev/null) ]] && return
  touch "$marker"
  for name in agent.zsh add.zsh; do
    tmp="$SUPPORT/$name.download"
    if curl -fsSL --max-time 60 "$SERVER/mac/$name" -o "$tmp" 2>/dev/null \
        && [[ "$(head -1 "$tmp")" == "#!/bin/zsh" ]] && zsh -n "$tmp" 2>/dev/null; then
      if ! cmp -s "$tmp" "$SUPPORT/$name"; then
        chmod 755 "$tmp" && mv -f "$tmp" "$SUPPORT/$name" && log "Updated $name."
      fi
    fi
    rm -f "$tmp"
  done
}
[[ -z "$SGS_NO_UPDATE" ]] && self_update

# ---- Hourly timer (was every 5 minutes) ----------------------------------
# Each run talks to the website's database, so a 5-minute timer kept it awake
# all day (Neon charges for awake time). New files still start a run straight
# away (WatchPaths). launchd reads the new timer the next time the Mac
# restarts or Steve logs in again.
UPLOADER_PLIST="$HOME/Library/LaunchAgents/com.stevegregson.storage.plist"
if [[ -f "$UPLOADER_PLIST" ]] \
   && [[ "$(plutil -extract StartInterval raw -o - "$UPLOADER_PLIST" 2>/dev/null)" != "3600" ]]; then
  if plutil -replace StartInterval -integer 3600 "$UPLOADER_PLIST" 2>/dev/null; then
    log "Timer changed to every 60 minutes (takes effect after the next restart)."
  fi
fi

# ---- Finder right-click options (Quick Actions) --------------------------
# Written into ~/Library/Services by the app itself, so they arrive with the
# daily self-update. Bump QA_VERSION to rewrite them.
QA_VERSION=1
make_quick_action() {
  local title="$1" kind="$2" dir="$HOME/Library/Services/$1.workflow"
  local cmd='/bin/zsh "$HOME/Library/Application Support/Steve Gregson Storage/agent.zsh" --request '"$kind"' "$@"'
  rm -rf "$dir"; mkdir -p "$dir/Contents" || return 1
  cat > "$dir/Contents/Info.plist" <<QAINFO
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSBackgroundColorName</key><string>background</string>
			<key>NSIconName</key><string>NSActionTemplate</string>
			<key>NSMenuItem</key><dict><key>default</key><string>$title</string></dict>
			<key>NSMessage</key><string>runWorkflowAsService</string>
			<key>NSRequiredContext</key><dict><key>NSApplicationIdentifier</key><string>com.apple.finder</string></dict>
			<key>NSSendFileTypes</key><array><string>public.item</string></array>
		</dict>
	</array>
</dict>
</plist>
QAINFO
  cat > "$dir/Contents/document.wflow" <<QAFLOW
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key><string>523</string>
	<key>AMApplicationVersion</key><string>2.10</string>
	<key>AMDocumentVersion</key><string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key><string>List</string>
					<key>Optional</key><true/>
					<key>Types</key><array><string>com.apple.cocoa.string</string></array>
				</dict>
				<key>AMActionVersion</key><string>2.0.3</string>
				<key>AMApplication</key><array><string>Automator</string></array>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key><dict/>
					<key>CheckedForUserDefaultShell</key><dict/>
					<key>inputMethod</key><dict/>
					<key>shell</key><dict/>
					<key>source</key><dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key><string>List</string>
					<key>Types</key><array><string>com.apple.cocoa.string</string></array>
				</dict>
				<key>ActionBundlePath</key><string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key><string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key><string>$cmd</string>
					<key>CheckedForUserDefaultShell</key><true/>
					<key>inputMethod</key><integer>1</integer>
					<key>shell</key><string>/bin/zsh</string>
					<key>source</key><string></string>
				</dict>
				<key>BundleIdentifier</key><string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key><string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key><false/>
				<key>CanShowWhenRun</key><true/>
				<key>Category</key><array><string>AMCategoryUtilities</string></array>
				<key>Class Name</key><string>RunShellScriptAction</string>
				<key>InputUUID</key><string>$(uuidgen)</string>
				<key>Keywords</key><array><string>Shell</string><string>Script</string></array>
				<key>OutputUUID</key><string>$(uuidgen)</string>
				<key>UUID</key><string>$(uuidgen)</string>
				<key>UnlocalizedApplications</key><array><string>Automator</string></array>
				<key>isViewVisible</key><integer>1</integer>
			</dict>
			<key>isViewVisible</key><integer>1</integer>
		</dict>
	</array>
	<key>connectors</key><dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>applicationBundleIDsByPath</key><dict/>
		<key>applicationPaths</key><array/>
		<key>inputTypeIdentifier</key><string>com.apple.Automator.fileSystemObject</string>
		<key>outputTypeIdentifier</key><string>com.apple.Automator.nothing</string>
		<key>presentationMode</key><integer>15</integer>
		<key>processesInput</key><integer>0</integer>
		<key>serviceInputTypeIdentifier</key><string>com.apple.Automator.fileSystemObject</string>
		<key>serviceOutputTypeIdentifier</key><string>com.apple.Automator.nothing</string>
		<key>serviceProcessesInput</key><integer>0</integer>
		<key>systemImageName</key><string>NSActionTemplate</string>
		<key>useAutomaticInputType</key><integer>0</integer>
		<key>workflowTypeIdentifier</key><string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>
QAFLOW
  plutil -lint "$dir/Contents/Info.plist" >/dev/null 2>&1 && plutil -lint "$dir/Contents/document.wflow" >/dev/null 2>&1
}
install_quick_actions() {
  local marker="$SUPPORT/quick-actions-version"
  [[ -f "$marker" && "$(<"$marker")" == "$QA_VERSION" \
     && -d "$HOME/Library/Services/Bring back from Storage.workflow" \
     && -d "$HOME/Library/Services/Clear from Mac now.workflow" ]] && return
  if make_quick_action "Bring back from Storage" bring-back \
     && make_quick_action "Clear from Mac now" clear-now; then
    print -r -- "$QA_VERSION" > "$marker"
    /System/Library/CoreServices/pbs -update >/dev/null 2>&1
    log "Added the Finder right-click options: Bring back from Storage, Clear from Mac now."
  else
    log "Couldn't add the Finder right-click options."
  fi
}
[[ -z "$SGS_NO_QUICK_ACTIONS" ]] && install_quick_actions

# ---- Menu bar progress icon ----------------------------------------------
# Built here from StatusBar.swift with Apple's free developer tools (the
# same ones git uses), so there's nothing to buy or sign. It just reads
# status.json. Bump MB_VERSION to rebuild it after StatusBar.swift changes.
MB_VERSION=6
MB_LABEL="com.stevegregson.storage.menubar"
MB_APP="$HOME/Applications/Steve Gregson Storage Progress.app"
install_menubar() {
  local marker="$SUPPORT/menubar-version" failed="$SUPPORT/menubar-failed"
  local build="$SUPPORT/menubar-build" plist="$HOME/Library/LaunchAgents/$MB_LABEL.plist"
  local dev app out
  [[ -f "$marker" && "$(<"$marker")" == "$MB_VERSION" && -x "$MB_APP/Contents/MacOS/StorageProgress" ]] && return
  # After a failed attempt, try again once a day rather than every run
  # (straight away when there's a new version to try).
  [[ -f "$failed" && "$(<"$failed")" == "$MB_VERSION" && -z $(find "$failed" -mmin +1440 2>/dev/null) ]] && return
  print -r -- "$MB_VERSION" > "$failed"
  dev=$(xcode-select -p 2>/dev/null)
  if [[ -z "$dev" || ! -d "$dev" ]]; then
    log "Menu bar icon not added: Apple's free developer tools aren't installed (Terminal: xcode-select --install)."
    return
  fi
  rm -rf "$build"; mkdir -p "$build" || return
  if ! curl -fsSL --max-time 60 "$SERVER/mac/StatusBar.swift" -o "$build/StatusBar.swift" 2>/dev/null \
     || [[ "$(head -1 "$build/StatusBar.swift")" != "// Steve Gregson Storage"* ]]; then
    log "Menu bar icon not added: couldn't download it (will try again tomorrow)."
    return
  fi
  app="$build/Steve Gregson Storage Progress.app"
  mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
  if ! out=$(cd "$build" && xcrun --sdk macosx swiftc -O -swift-version 5 -parse-as-library -o "$app/Contents/MacOS/StorageProgress" StatusBar.swift 2>&1); then
    log "Menu bar icon not added: it didn't build (will try again tomorrow). ${out[1,3000]}"
    return
  fi
  cat > "$app/Contents/Info.plist" <<MBINFO
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>$MB_LABEL</string>
  <key>CFBundleName</key><string>Steve Gregson Storage Progress</string>
  <key>CFBundleExecutable</key><string>StorageProgress</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$MB_VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
MBINFO
  codesign --force --sign - "$app" >/dev/null 2>&1

  # Swap in the new version and keep it running (and starting at login).
  launchctl bootout "gui/$(id -u)/$MB_LABEL" >/dev/null 2>&1
  rm -rf "$MB_APP"; mkdir -p "${MB_APP:h}"
  mv -f "$app" "$MB_APP" || return
  rm -rf "$build"
  cat > "$plist" <<MBPLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$MB_LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$MB_APP/Contents/MacOS/StorageProgress</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
MBPLIST
  if launchctl bootstrap "gui/$(id -u)" "$plist" >/dev/null 2>&1; then
    print -r -- "$MB_VERSION" > "$marker"
    rm -f "$failed"
    log "Added the upload progress icon to the menu bar."
    notify "Upload progress now shows in the menu bar (the cloud icon at the top of the screen)."
  else
    log "Menu bar icon built but couldn't be started (will try again tomorrow)."
  fi
}

# ---- One-off: bring back folders that older versions removed ----------
# Earlier versions deleted a show's folders once its files were cleared.
# Recreate them (empty) from the log's "Freed space" lines. Runs once.
RESTORED="$SUPPORT/folders-restored"
if [[ ! -f "$RESTORED" && -f "$LOG" ]]; then
  typeset -A RDIRS
  while IFS= read -r line; do
    [[ "$line" == *"  Freed space: "*" is now only in Storage ("* ]] || continue
    rel="${line#*  Freed space: }"
    rel="${rel%" is now only in Storage ("*}"
    dir="${rel:h}"
    [[ -n "$dir" && "$dir" != "." && "$dir" != /* && "$dir" != *..* ]] && RDIRS[$dir]=1
  done < "$LOG"
  rcount=0
  for dir in ${(k)RDIRS}; do
    [[ -d "$ROOT/$dir" ]] && continue
    mkdir -p -- "$ROOT/$dir" && (( rcount++ ))
  done
  touch "$RESTORED"
  (( rcount > 0 )) && log "Brought back $rcount folders that were removed when their files were cleared."
fi

# ---- Show every top-level Storage folder on the Mac ---------------------
# (empty until something is put in them; nothing is downloaded)
# Folders already known to Storage (one per line), so each is only sent once
# and a folder deleted on the website isn't put back from here.
FOLDERS="$SUPPORT/folders.txt"
touch "$FOLDERS"
typeset -A KNOWN
while IFS= read -r line; do [[ -n "$line" ]] && KNOWN[$line]=1; done < "$FOLDERS"
remember_folder() { KNOWN[$1]=1; print -r -- "$1" >> "$FOLDERS"; }

reply=$(api '{"action":"folders"}')
if [[ "$(jget "$reply" ok)" == "true" ]]; then
  while IFS= read -r name; do
    [[ -z "$name" || "$name" == .* || "$name" == */* ]] && continue
    [[ -z "${KNOWN[$name]}" ]] && remember_folder "$name"
    [[ -e "$ROOT/$name" ]] || { mkdir -p -- "$ROOT/$name" && log "Added folder $name (from Storage)."; }
  done <<< "$(jget "$reply" list)"
fi

# ---- Folders made on the Mac appear in Storage straight away -----------
# (including empty ones, ready for photos)
while IFS= read -r -d '' dir; do
  rel="${dir#$ROOT/}"
  [[ "$rel" == *$'\t'* || "$rel" == *$'\n'* || -n "${KNOWN[$rel]}" ]] && continue
  reply=$(api "{\"action\":\"folder\",\"path\":\"$(json_escape "$rel")\"}")
  if [[ "$(jget "$reply" ok)" == "true" ]]; then
    remember_folder "$rel"
    log "Created folder $rel in Storage."
  fi
done < <(find "$ROOT" -mindepth 1 -type d ! -name '.*' ! -path '*/.*' -print0 2>/dev/null)

fetched=0
fetched_bytes=0
onmac_stats

# ---- Paused? Report it, keep the watcher going, upload nothing ----------
start_pause_watch() {
  [[ -f "$WATCH_PID" ]] && kill -0 "$(<"$WATCH_PID")" 2>/dev/null && return
  # In its own session, so it outlives this run (launchd ends the run's
  # whole process group when the run finishes).
  if [[ -n "$SGS_WATCH_INLINE" ]]; then
    zsh "$SCRIPT_PATH" --pause-watch >/dev/null 2>&1 &!
  else
    /usr/bin/perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' /bin/zsh "$SCRIPT_PATH" --pause-watch </dev/null >/dev/null 2>&1 &!
  fi
}
if is_paused; then
  PAUSED=true; PAUSED_UNTIL=$(pause_until)
  STATUS_STATE="paused"
  # How many files are waiting (quick: sizes/dates only, nothing uploaded).
  while IFS= read -r -d '' file; do
    rel="${file#$ROOT/}"
    zstat -A st -- "$file" 2>/dev/null || continue
    [[ -n "${S_SIZE[$rel]}" && "${S_SIZE[$rel]}" == "${st[8]}" && "${S_MTIME[$rel]}" == "${st[10]}" ]] && continue
    (( pending++ ))
    (( BUSY[${rel:h}]++ ))
  done < <(find "$ROOT" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' -print0 2>/dev/null)
  write_status now
  start_pause_watch
  [[ -z "$SGS_NO_MENUBAR" ]] && install_menubar
  exit 0
fi

# ---- 1. Upload new or changed files ------------------------------------
# Each file is uploaded by its own background job (UPLOAD_JOBS at a time).
# A job writes its outcome to a small file; this run reads it back and
# records the upload, so the record of what's uploaded is kept in one place.
RESULTS="$SUPPORT/uploading"
rm -rf "$RESULTS"; mkdir -p "$RESULTS"
typeset -A RUNNING      # process id -> job number (JOB_REL: job number -> relative path)
job_no=0
unsaved=0

# Uploads one file and writes "ok/big/fail/skip …" to $3. Runs in the background.
upload_one() {
  local file="$1" rel="$2" out="$3" size="$4" mtime="$5"
  local md5 reply remote url content_md5
  local -a after
  finish() { print -r -- "$1" > "$out.tmp" && mv -f "$out.tmp" "$out"; }

  md5=$(md5_of "$file")
  [[ ${#md5} -eq 32 ]] || { finish skip; return; }

  # Renamed or moved on the Mac without being changed (Finder rename, moved
  # into a new folder, Bridge rename with no metadata edit)? Then rename the
  # copy in Storage instead of uploading it again — no duplicate, no wait.
  local old="${GONE_BY_KEY[$size:$md5]}"
  if [[ -n "$old" ]]; then
    reply=$(api "{\"action\":\"move\",\"from\":\"$(json_escape "${S_REMOTE[$old]:-$old}")\",\"to\":\"$(json_escape "$rel")\",\"size\":$size,\"md5Hex\":\"$md5\"}")
    if [[ "$(jget "$reply" ok)" == "true" ]]; then
      remote=$(jget "$reply" remotePath)
      log "Moved in Storage: $old → $rel"
      finish "ok"$'\t'"$size"$'\t'"$mtime"$'\t'"$md5"$'\t'"$remote"$'\t'"$old"
      return
    fi
    # Not possible (e.g. that name is taken): upload as normal below.
  fi

  reply=$(api "{\"action\":\"presign\",\"path\":\"$(json_escape "$rel")\",\"size\":$size,\"md5Hex\":\"$md5\"}")
  if [[ "$(jget "$reply" ok)" != "true" ]]; then
    if [[ "$(jget "$reply" code)" == "too_big" ]]; then finish big; return; fi
    log "Couldn't start upload of $rel: $(jget "$reply" message)"
    finish fail; return
  fi
  remote=$(jget "$reply" remotePath)

  if [[ "$(jget "$reply" status)" == "upload" ]]; then
    url=$(jget "$reply" uploadUrl)
    content_md5=$(jget "$reply" contentMd5)
    if ! curl -sS --fail --max-time 21600 --retry 3 --retry-delay 5 \
        -X PUT -H "Content-MD5: $content_md5" --upload-file "$file" "$url" -o /dev/null; then
      log "Upload failed for $rel (will retry next time)."
      finish fail; return
    fi
    reply=$(api "{\"action\":\"commit\",\"remotePath\":\"$(json_escape "$remote")\",\"size\":$size,\"md5Hex\":\"$md5\"}")
    if [[ "$(jget "$reply" ok)" != "true" ]]; then
      log "Storage couldn't confirm $rel: $(jget "$reply" message)"
      finish fail; return
    fi
  fi

  # Storage now holds this version, so ALWAYS record it — even if the file was
  # changed or renamed while it uploaded (Bridge often renames during a big
  # upload). Recorded with the size/date it had when sent, so a changed file
  # is simply sent again next time (replacing this copy) and a renamed one is
  # mirrored (this copy goes to Deleted files). Before 20 Nov such uploads
  # were left unrecorded and became untracked duplicates in Storage.
  after=($(file_info "$file"))
  if [[ "${after[1]}" != "$size" || "${after[2]}" != "$mtime" ]]; then
    log "Uploaded $rel as $remote but it changed while uploading; will check it again."
    finish "ok"$'\t'"$size"$'\t'"$mtime"$'\t'"$md5"$'\t'"$remote"
    return
  fi

  if [[ "$remote" == "$rel" ]]; then log "Uploaded $rel"; else log "Uploaded $rel as $remote (a different file already had that name)"; fi
  finish "ok"$'\t'"$size"$'\t'"$mtime"$'\t'"$md5"$'\t'"$remote"
}

# Records the outcome of one finished job.
collect() {
  local n=$1 rel=${JOB_REL[$1]} line=""
  local -a f
  [[ -f "$RESULTS/$n" ]] && line=$(<"$RESULTS/$n")
  rm -f "$RESULTS/$n" "$RESULTS/$n.tmp"
  unset "JOB_REL[$n]"
  f=("${(@ps:\t:)line}")
  # Safely in Storage now: no longer "still updating". (Failed or changed
  # files stay counted until a later pass gets them up.)
  if [[ "${f[1]}" == ok || "${f[1]}" == got ]]; then
    if (( ${BUSY[${rel:h}]:-0} > 1 )); then (( BUSY[${rel:h}]-- )); else unset "BUSY[${rel:h}]"; fi
  fi
  case "${f[1]}" in
    ok)
      if [[ -n "${f[6]}" ]]; then
        # Renamed in Storage from its old Mac name: keep its upload time (so
        # clearing stays on schedule) and stop tracking the old name.
        S_AT[$rel]=${S_AT[${f[6]}]:-$NOW}
        local od="${f[6]:h}" nd="${rel:h}"
        if [[ "$od" != "$nd" ]]; then
          # Same folder → same new folder for every photo = a folder rename/move.
          if [[ -z "${DIRMAP[$od]}" ]]; then DIRMAP[$od]=$nd
          elif [[ "${DIRMAP[$od]}" != "$nd" ]]; then DIRMAP[$od]="!"; fi
        fi
        forget "${f[6]}"
        (( moved++ ))
      else
        S_AT[$rel]=$NOW
        (( uploaded++ ))
        (( uploaded_bytes += f[2] ))
      fi
      S_SIZE[$rel]=${f[2]}; S_MTIME[$rel]=${f[3]}; S_MD5[$rel]=${f[4]}; S_REMOTE[$rel]=${f[5]}
      print -r -- "${f[5]:-$rel}" >> "$HISTORY"
      (( unsaved++ ))
      RECENT+=("$EPOCHSECONDS"$'\t'"$rel")
      (( ${#RECENT} > 6 )) && RECENT=("${(@)RECENT[-6,-1]}")
      ;;
    got)
      # Brought back from Storage: it's already there, so no upload needed,
      # and it stays on the Mac for OFFLOAD_DAYS from now.
      S_SIZE[$rel]=${f[2]}; S_MTIME[$rel]=${f[3]}; S_MD5[$rel]=${f[4]}; S_AT[$rel]=$(date +%s); S_REMOTE[$rel]=${f[5]}
      print -r -- "${f[5]:-$rel}" >> "$HISTORY"
      (( fetched++ ))
      (( fetched_bytes += f[2] ))
      (( unsaved++ ))
      ;;
    big)  too_big+=("$rel") ;;
    skip) ;;
    *)    (( failed++ )) ;;
  esac
}

# Collects every job that has finished; saves the record every 50 uploads.
reap() {
  local pid n
  for pid in ${(k)RUNNING}; do
    n=${RUNNING[$pid]}
    if [[ -f "$RESULTS/$n" ]] || ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null
      unset "RUNNING[$pid]"
      collect "$n"
    fi
  done
  if (( unsaved >= 50 )); then save_state; unsaved=0; fi
  touch "$LOCK" 2>/dev/null
  write_status
}

upload_pass() {
  local i r
  local -a c_file c_rel c_size c_mtime st
  pending=0; checked=0
  # Tracked files no longer at their name on the Mac, by size+fingerprint:
  # a new file with the same contents is the same photo renamed/moved.
  BUSY=()
  GONE_BY_KEY=()
  for r in ${(k)S_SIZE}; do
    [[ -f "$ROOT/$r" || -z "${S_MD5[$r]}" ]] && continue
    GONE_BY_KEY[${S_SIZE[$r]}:${S_MD5[$r]}]=$r
  done
  STATUS_STATE="checking"
  write_status now
  # First find everything to upload, so progress can show how much is left.
  while IFS= read -r -d '' file; do
    rel="${file#$ROOT/}"
    [[ "$rel" == *$'\t'* || "$rel" == *$'\n'* ]] && { log "Skipped (tab or line break in name): $rel"; continue; }

    zstat -A st -- "$file" 2>/dev/null || continue
    size=${st[8]}; mtime=${st[10]}; ctime=${st[11]}
    (( ++checked % 500 == 0 )) && { touch "$LOCK" 2>/dev/null; write_status; }

    # Already uploaded and unchanged?
    if [[ -n "${S_SIZE[$rel]}" && "${S_SIZE[$rel]}" == "$size" && "${S_MTIME[$rel]}" == "$mtime" ]]; then
      continue
    fi

    # Wait until a file has finished copying in.
    newest=$(( mtime > ctime ? mtime : ctime ))
    (( BUSY[${rel:h}]++ ))
    (( NOW - newest < SETTLE_SECONDS )) && { (( pending++ )); continue; }

    if (( size > MAX_BYTES )); then
      [[ ${too_big[(Ie)$rel]} -eq 0 ]] && too_big+=("$rel")
      continue
    fi

    c_file+=("$file"); c_rel+=("$rel"); c_size+=("$size"); c_mtime+=("$mtime")
  done < <(find "$ROOT" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' -print0 2>/dev/null)

  plan_files=$(( uploaded + ${#c_rel} )); plan_bytes=$uploaded_bytes
  for size in $c_size; do (( plan_bytes += size )); done
  if (( ${#c_rel} > 0 )); then STATUS_STATE="uploading"
  elif (( pending > 0 )); then STATUS_STATE="waiting"
  else STATUS_STATE="idle"
  fi
  write_status now

  for (( i = 1; i <= ${#c_rel}; i++ )); do
    # Wait for a free slot, then start this file's upload.
    while (( ${#RUNNING} >= UPLOAD_JOBS )); do
      sleep 0.2
      reap
    done
    (( job_no++ ))
    JOB_REL[$job_no]=${c_rel[$i]}
    upload_one "${c_file[$i]}" "${c_rel[$i]}" "$RESULTS/$job_no" "${c_size[$i]}" "${c_mtime[$i]}" &
    RUNNING[$!]=$job_no
    write_status
  done

  # Let the last uploads finish.
  while (( ${#RUNNING} > 0 )); do
    sleep 0.2
    reap
  done
  save_state; unsaved=0
  # Anything that failed is retried next time; count only what's done.
  plan_files=$uploaded; plan_bytes=$uploaded_bytes
}

# Files that have only just arrived are given a few seconds to finish copying,
# so keep going round until everything waiting has been uploaded.
for round in 1 2 3 4 5 6 7 8; do
  upload_pass
  (( pending == 0 )) && break
  [[ -n "$SGS_NOW" ]] && break
  sleep 15
  NOW=$(date +%s)
done
onmac_stats
STATUS_STATE="tidying"
write_status

# ---- Folders renamed or moved on the Mac ---------------------------------
# Every photo that came from one old folder went to the same new folder, and
# the old folder is gone from the Mac: it was renamed/moved. Bring across
# anything still in the old Storage folder (e.g. photos already cleared from
# the Mac), then remove the old folder (and empty parents) if nothing is left.
if (( moved > 0 )); then
  log "Renamed/moved on the Mac: renamed $moved file(s) in Storage to match (nothing uploaded again)."
  # A renamed show folder shows up as its sub-folders moving ("Show/Web" →
  # "Show fixed/Web"); add the show folder itself, so loose files in it come
  # too. Deepest first, so sub-folders are done before their parents.
  for od in ${(k)DIRMAP}; do
    nd=${DIRMAP[$od]}; [[ "$nd" == "!" ]] && continue
    while [[ "$od" == */* && "$nd" == */* && "${od:t}" == "${nd:t}" && "${od:h}" != "${nd:h}" && ! -d "$ROOT/${od:h}" ]]; do
      od=${od:h}; nd=${nd:h}
      if [[ -z "${DIRMAP[$od]}" ]]; then DIRMAP[$od]=$nd
      elif [[ "${DIRMAP[$od]}" != "$nd" ]]; then DIRMAP[$od]="!"; break; fi
    done
  done
  for od in ${(Ok)DIRMAP}; do
    nd=${DIRMAP[$od]}
    [[ "$nd" == "!" || -d "$ROOT/$od" ]] && continue
    reply=$(api "{\"action\":\"merge-folder\",\"from\":\"$(json_escape "$od")\",\"to\":\"$(json_escape "$nd")\"}")
    if [[ "$(jget "$reply" ok)" == "true" ]]; then
      log "Folder renamed/moved on the Mac: $od → $nd ($(jget "$reply" moved) more file(s) moved in Storage, $(jget "$reply" kept) kept where a name was already taken)."
      d="$od"
      while [[ "$d" == */* && ! -d "$ROOT/$d" ]]; do
        api "{\"action\":\"remove-empty-folder\",\"path\":\"$(json_escape "$d")\"}" >/dev/null
        d="${d:h}"
      done
    else
      log "Couldn't finish moving folder $od → $nd in Storage: $(jget "$reply" message)"
    fi
    touch "$LOCK" 2>/dev/null
  done
  notify "Renamed $moved file$( (( moved == 1 )) || print -n s) in Storage to match your Mac (nothing uploaded again)."
fi

# Clears one uploaded file from the Mac, but only once the Mac copy is
# unchanged AND Storage confirms it holds an exact copy. 0 = cleared.
clear_one() {
  local rel="$1" file="$ROOT/$1" reply reason size
  local -a info
  [[ -f "$file" && -n "${S_SIZE[$rel]}" ]] || return 1
  info=($(file_info "$file")) || return 1
  # Changed since it was uploaded: the upload step will send the new version.
  [[ "${info[1]}" == "${S_SIZE[$rel]}" && "${info[2]}" == "${S_MTIME[$rel]}" ]] || return 1

  # Re-check the file on the Mac really is what was uploaded…
  [[ "$(md5_of "$file")" == "${S_MD5[$rel]}" ]] || { log "Kept $rel: it no longer matches what was uploaded."; return 1; }

  # …and that Storage holds an exact copy right now.
  reply=$(api "{\"action\":\"verify\",\"remotePath\":\"$(json_escape "${S_REMOTE[$rel]}")\",\"size\":${S_SIZE[$rel]},\"md5Hex\":\"${S_MD5[$rel]}\"}")
  if [[ "$(jget "$reply" ok)" != "true" || "$(jget "$reply" safe)" != "true" ]]; then
    reason=$(jget "$reply" reason)
    case "$reason" in
      deleted_in_storage) log "Kept $rel on the Mac: it was deleted in Storage." ;;
      not_recorded|missing) log "Kept $rel on the Mac: Storage no longer has it; it will be uploaded again."; forget "$rel" ;;
      *) log "Kept $rel on the Mac for now (couldn't confirm the copy in Storage)." ;;
    esac
    return 1
  fi

  size=${S_SIZE[$rel]}
  if rm -f -- "$file"; then
    print -r -- "$rel" >> "$CLEARED"
    [[ -n "${S_REMOTE[$rel]}" && "${S_REMOTE[$rel]}" != "$rel" ]] && print -r -- "${S_REMOTE[$rel]}" >> "$CLEARED"
    forget "$rel"
    (( freed++ ))
    (( freed_bytes += size ))
    log "Freed space: $rel is now only in Storage ($(jget "$reply" remotePath))."
    return 0
  fi
  return 1
}

# "Clear from Mac now": a file or a whole folder, whatever its age.
clear_now() {
  local rel="$1" r kept=0 f0=$freed b0=$freed_bytes done_n done_b
  local -a targets
  if [[ -d "$ROOT/$rel" ]]; then
    for r in ${(k)S_SIZE}; do [[ "$r" == "$rel"/* ]] && targets+=("$r"); done
  else
    [[ -n "${S_SIZE[$rel]}" ]] && targets+=("$rel")
  fi
  for r in $targets; do
    clear_one "$r"
    touch "$LOCK" 2>/dev/null
  done
  # Anything left here isn't safely in Storage yet (or was just added).
  kept=$(find "$ROOT/$rel" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' 2>/dev/null | wc -l | tr -d ' ')
  done_n=$(( freed - f0 )); done_b=$(( freed_bytes - b0 ))
  freed=$f0; freed_bytes=$b0     # reported here, not in the daily "Freed" message
  log "Clear from Mac now: $rel — cleared $done_n file(s) ($(human $done_b)), $kept kept."
  if (( kept > 0 )); then
    notify "Cleared $done_n file(s) ($(human $done_b)) from ${rel:t}. $kept kept: not safely in Storage yet (they'll upload first)."
  else
    notify "Cleared $done_n file(s) ($(human $done_b)) from ${rel:t}. They're only in Storage now."
  fi
}

# Fetches one file back from Storage. Runs in the background like uploads.
download_one() {
  local rel="$1" out="$2" file="$ROOT/$1" tmp reply url want md5
  local -a info
  finish() { print -r -- "$1" > "$out.tmp" && mv -f "$out.tmp" "$out"; }

  mkdir -p -- "${file:h}" || { finish fail; return; }
  tmp="${file:h}/.${file:t}.sgdl"      # hidden while downloading, so it isn't uploaded
  reply=$(api "{\"action\":\"download\",\"path\":\"$(json_escape "$rel")\"}")
  if [[ "$(jget "$reply" ok)" != "true" ]]; then
    log "Couldn't bring back $rel: $(jget "$reply" message)"
    finish fail; return
  fi
  url=$(jget "$reply" url); want=$(jget "$reply" size)
  if ! curl -sS --fail --max-time 21600 --retry 3 --retry-delay 5 -o "$tmp" "$url"; then
    rm -f -- "$tmp"; log "Download failed for $rel (try Bring back again)."
    finish fail; return
  fi
  info=($(file_info "$tmp"))
  if [[ "${info[1]}" != "$want" ]]; then
    rm -f -- "$tmp"; log "Download of $rel was incomplete (try Bring back again)."
    finish fail; return
  fi
  md5=$(md5_of "$tmp")
  # Mark Storage's copy as this Mac's, so it's never uploaded again as a duplicate.
  reply=$(api "{\"action\":\"commit\",\"remotePath\":\"$(json_escape "$rel")\",\"size\":$want,\"md5Hex\":\"$md5\"}")
  if [[ "$(jget "$reply" ok)" != "true" ]]; then
    rm -f -- "$tmp"; log "Storage couldn't confirm $rel: $(jget "$reply" message)"
    finish fail; return
  fi
  if [[ -e "$file" ]]; then rm -f -- "$tmp"; finish skip; return; fi
  mv -f -- "$tmp" "$file" || { rm -f -- "$tmp"; finish fail; return; }
  info=($(file_info "$file"))
  log "Brought back $rel from Storage."
  finish "got"$'\t'"${info[1]}"$'\t'"${info[2]}"$'\t'"$md5"$'\t'"$rel"
}

# "Bring back from Storage": every file in that folder that isn't on the Mac.
bring_back() {
  local rel="$1" reply p size need=0 skipped=0 avail f0=$fetched b0=$fetched_bytes x0=$failed
  local -a todo
  reply=$(api "{\"action\":\"list\",\"path\":\"$(json_escape "$rel")\"}")
  if [[ "$(jget "$reply" ok)" != "true" ]]; then
    log "Couldn't bring back $rel: $(jget "$reply" message)"
    notify "Couldn't bring back ${rel:t}: $(jget "$reply" message)"
    return
  fi
  while IFS=$'\t' read -r p size; do
    [[ -z "$p" ]] && continue
    if [[ -e "$ROOT/$p" ]]; then (( skipped++ )); continue; fi
    todo+=("$p"); (( need += size ))
  done <<< "$(jget "$reply" list)"
  if (( ${#todo} == 0 )); then
    notify "Everything in ${rel:t} is already on this Mac."
    return
  fi
  # Disk space: keep at least KEEP_FREE_GB free.
  avail=$(df -k "$ROOT" 2>/dev/null | awk 'NR==2 {print $4}')
  avail=$(( ${avail:-0} * 1024 ))
  if (( need + KEEP_FREE_GB * 1073741824 > avail )); then
    log "Didn't bring back $rel: needs $(human $need), only $(human $avail) free (keeping $KEEP_FREE_GB GB spare)."
    notify "Not enough space to bring back ${rel:t}: it needs $(human $need) and only $(human $avail) is free ($KEEP_FREE_GB GB is kept spare)."
    return
  fi
  log "Bringing back ${#todo} file(s) ($(human $need)) from Storage: $rel"
  local state_before="$STATUS_STATE"
  down_files=${#todo}; down_bytes=$need; down_f0=$fetched; down_b0=$fetched_bytes
  STATUS_STATE="downloading"
  write_status now
  for p in $todo; do
    while (( ${#RUNNING} >= UPLOAD_JOBS )); do
      sleep 0.2
      reap
    done
    (( job_no++ ))
    JOB_REL[$job_no]=$p
    download_one "$p" "$RESULTS/$job_no" &
    RUNNING[$!]=$job_no
  done
  while (( ${#RUNNING} > 0 )); do
    sleep 0.2
    reap
  done
  save_state; unsaved=0
  STATUS_STATE="$state_before"; down_files=0; down_bytes=0; down_f0=$fetched; down_b0=$fetched_bytes
  write_status now
  local got=$(( fetched - f0 )) bad=$(( failed - x0 ))
  failed=$x0
  if (( bad > 0 )); then
    notify "Brought back $got file(s) to ${rel:t}; $bad couldn't be fetched — try Bring back again."
  else
    notify "Brought back $got file(s) ($(human $(( fetched_bytes - b0 )))) to ${rel:t}. They'll stay on this Mac for $OFFLOAD_DAYS days."
  fi
}

# ---- One-off tidy of older duplicates (before renames were mirrored) ------
# tidy-report: for each folder that still has files on the Mac, lists files
# in Storage that aren't on the Mac any more and weren't cleared by this app
# (i.e. old export names left behind by renaming in Bridge). Nothing is
# changed. tidy-apply: sends exactly that list to Deleted files (only files
# this Mac uploaded; restorable for 30 days).
TIDY_REPORT="${LOG:h}/Steve Gregson Storage - tidy report.txt"
tidy_report() {
  local scope="$1" line rel dir p size reply count=0 bytes=0
  [[ "$scope" == ALL ]] && scope=""
  local -A onmac freed dirs
  local -a out
  while IFS= read -r -d '' f; do
    rel="${f#$ROOT/}"; onmac[$rel]=1; dirs[${rel:h}]=1
  done < <(find "$ROOT/$scope" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' -print0 2>/dev/null)
  while IFS= read -r line; do
    [[ "$line" == *"  Freed space: "*" is now only in Storage ("* ]] || continue
    rel="${line#*  Freed space: }"; freed[${rel%" is now only in Storage ("*}]=1
    p="${line##* is now only in Storage \(}"; freed[${p%\).}]=1
  done < "$LOG"
  for dir in ${(k)dirs}; do
    [[ "$dir" == "." ]] && continue
    reply=$(api "{\"action\":\"list\",\"path\":\"$(json_escape "$dir")\"}")
    [[ "$(jget "$reply" ok)" == "true" ]] || continue
    while IFS=$'\t' read -r p size; do
      [[ -z "$p" || "${p:h}" != "$dir" ]] && continue
      [[ -n "${onmac[$p]}" || -n "${freed[$p]}" ]] && continue
      out+=("$p"$'\t'"$size"); (( count++ )); (( bytes += size ))
    done <<< "$(jget "$reply" list)"
    touch "$LOCK" 2>/dev/null
  done
  print -rl -- "${(o)out[@]}" > "$TIDY_REPORT"
  log "Tidy report: $count leftover file(s) ($(human $bytes)) in Storage — see $TIDY_REPORT. Nothing changed."
  notify "Found $count leftover cop$( (( count == 1 )) && print -n y || print -n ies) in Storage ($(human $bytes)). Nothing has been changed yet."
}
tidy_apply() {
  local -a list
  local p size body sep reply i trashed=0
  [[ -s "$TIDY_REPORT" ]] || { notify "No tidy report to apply."; return; }
  while IFS=$'\t' read -r p size; do [[ -n "$p" ]] && list+=("$p"); done < "$TIDY_REPORT"
  for (( i = 1; i <= ${#list}; i += 50 )); do
    body=""; sep=""
    for p in "${(@)list[i,i+49]}"; do body+="$sep{\"path\":\"$(json_escape "$p")\"}"; sep=","; done
    reply=$(api "{\"action\":\"trash\",\"files\":[$body]}")
    [[ "$(jget "$reply" ok)" == "true" ]] || { log "Tidy stopped: $(jget "$reply" message)"; break; }
    (( trashed += $(jget "$reply" trashed) ))
    touch "$LOCK" 2>/dev/null
  done
  mv -f "$TIDY_REPORT" "$TIDY_REPORT.done" 2>/dev/null
  touch "$SUPPORT/leftovers-reviewed"   # from now on leftovers are tidied automatically
  log "Tidy: moved $trashed leftover cop$( (( trashed == 1 )) && print -n y || print -n ies) to Storage's Deleted files (restorable for 30 days)."
  notify "Moved $trashed leftover cop$( (( trashed == 1 )) && print -n y || print -n ies) to Deleted files in Storage (restorable for 30 days)."
}

# Works through the right-click requests queued from Finder.
process_requests() {
  [[ -s "$REQ" ]] || return
  local work="$SUPPORT/requests.working" kind rel
  local -A seen
  mv -f "$REQ" "$work" || return
  while IFS=$'\t' read -r kind rel; do
    rel="${rel%/}"
    [[ -z "$kind" || -z "$rel" || -n "${seen[$kind:$rel]}" ]] && continue
    seen[$kind:$rel]=1
    if [[ "$rel" == /* || "$rel" == .* || "$rel" == */.* || "$rel" == ../* || "$rel" == */../* ]]; then
      log "Ignored a request for $rel."
      continue
    fi
    case "$kind" in
      clear-now)  clear_now "$rel" ;;
      bring-back) bring_back "$rel" ;;
      tidy-report) tidy_report "$rel" ;;
      tidy-apply)  tidy_apply ;;
    esac
  done < "$work"
  rm -f -- "$work"
  save_state
}

process_requests

# ---- 2. Free up space for files uploaded over OFFLOAD_DAYS ago ---------
[[ "$OFFLOAD_SET" != "$OFFLOAD_DAYS" ]] && log "Days-to-keep setting was '$OFFLOAD_SET'; using $OFFLOAD_DAYS days instead (minimum is 1)."
cutoff=$(( NOW - OFFLOAD_DAYS * 86400 ))

# ---- What's on the Mac right now -----------------------------------------
# ONMAC: every file in the Storage folder (by its path, and by the Storage
# path it went to). HASFILES: every folder that has at least one file in it
# or in a sub-folder — i.e. folders Steve is still working in.
typeset -A ONMAC HASFILES
scan_onmac() {
  local f rel d
  ONMAC=(); HASFILES=()
  while IFS= read -r -d '' f; do
    rel="${f#$ROOT/}"
    ONMAC[$rel]=1
    [[ -n "${S_REMOTE[$rel]}" ]] && ONMAC[${S_REMOTE[$rel]}]=1
    d="${rel:h}"
    while [[ "$d" != "." && -n "$d" && -z "${HASFILES[$d]}" ]]; do
      HASFILES[$d]=1
      d="${d:h}"
    done
  done < <(find "$ROOT" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' -print0 2>/dev/null)
}
scan_onmac

# ---- Renamed, moved or deleted on the Mac: mirror it, like Dropbox --------
# A file this Mac uploaded that's no longer at that name was renamed (e.g. in
# Bridge), moved into a sub-folder, or deleted by Steve — files the app
# clears to save space are forgotten when cleared, so they never get here.
# Its old copy in Storage goes to Deleted files (restorable for 30 days).
# New names were uploaded in step 1 above, so nothing is ever without a copy.
#
# Mirrored when its folder still has files in it (or in its sub-folders):
# Steve is working in that show. If the whole folder has gone or is now
# completely empty (moved out of the Storage folder, drive problem…), Storage
# keeps everything: it's the archive.
#
# (Until 20 Nov a safety limit skipped mirroring whenever over 300 files and
# over half of everything vanished at once — which is exactly what renaming a
# whole show in Bridge does. That left 1,307 Reefer Madness duplicates.)
typeset -a gone_list
gone_kept=0
for rel in ${(k)S_SIZE}; do
  [[ -f "$ROOT/$rel" ]] && continue
  if [[ -n "${HASFILES[${rel:h}]}" ]]; then
    gone_list+=("$rel")
    TOUCHED[${rel:h}]=1
  else
    forget "$rel"; (( gone_kept++ ))
  fi
done
(( gone_kept > 0 )) && log "$gone_kept uploaded file(s) are gone from the Mac along with everything else in their folder; Storage keeps them."
mirror_gone() {
  local n=${#gone_list} i rel body sep reply trashed=0
  (( n == 0 )) && return
  for (( i = 1; i <= n; i += 50 )); do
    body=""; sep=""
    for rel in "${(@)gone_list[i,i+49]}"; do
      body+="$sep{\"path\":\"$(json_escape "${S_REMOTE[$rel]:-$rel}")\",\"size\":${S_SIZE[$rel]:-0},\"md5Hex\":\"${S_MD5[$rel]}\",\"exact\":true}"
      sep=","
    done
    reply=$(api "{\"action\":\"trash\",\"files\":[$body]}")
    if [[ "$(jget "$reply" ok)" != "true" ]]; then
      log "Couldn't update Storage for renamed/deleted files (will try again): $(jget "$reply" message)"
      break   # offline: keep them tracked and try next run
    fi
    (( trashed += $(jget "$reply" trashed) ))
    for rel in "${(@)gone_list[i,i+49]}"; do forget "$rel"; done
    touch "$LOCK" 2>/dev/null
    write_status
  done
  if (( trashed > 0 )); then
    log "Renamed or deleted on the Mac: moved $trashed old cop$( (( trashed == 1 )) && print -n y || print -n ies) to Storage's Deleted files (restorable for 30 days)."
  fi
  save_state
}
mirror_gone

# ---- Leftover old copies (belt and braces) --------------------------------
# Any file in Storage that THIS Mac put there (it's in the upload history),
# in a folder Steve still has files in, that isn't on the Mac any more and
# wasn't cleared by the app to save space, is an old name left behind (e.g.
# from a run that was stopped part-way, or older versions of this app). The
# server double-checks each one was uploaded by this Mac and is unchanged
# before it goes to Deleted files (restorable for 30 days). Files added in
# Backstage, by clients, or moved there in Backstage are never touched.
# Checks folders where something changed this run, and every folder once a day.
# The very first check only writes a report (nothing moved) so Steve and
# Claude can look at it first; after that it tidies automatically.
leftovers() {
  local -a dirs candidates
  local -A hist cleared
  local d p size reply line i body sep trashed=0 total_bytes=0
  local daily="$SUPPORT/.checked-leftovers" first_marker="$SUPPORT/leftovers-reviewed"
  if [[ ! -f "$daily" || -n $(find "$daily" -mmin +1440 2>/dev/null) ]]; then
    dirs=(${(k)HASFILES}); touch "$daily"
  else
    for d in ${(k)TOUCHED}; do
      while [[ "$d" != "." && -n "$d" ]]; do
        [[ -n "${HASFILES[$d]}" ]] && dirs+=("$d")
        d="${d:h}"
      done
    done
    dirs=(${(u)dirs})
  fi
  (( ${#dirs} == 0 )) && return
  while IFS= read -r line; do [[ -n "$line" ]] && hist[$line]=1; done < "$HISTORY"
  while IFS= read -r line; do [[ -n "$line" ]] && cleared[$line]=1; done < "$CLEARED"
  for d in $dirs; do
    reply=$(api "{\"action\":\"files\",\"path\":\"$(json_escape "$d")\"}")
    [[ "$(jget "$reply" ok)" == "true" ]] || continue
    while IFS=$'\t' read -r p size; do
      [[ -z "$p" || -n "${ONMAC[$p]}" || -n "${cleared[$p]}" || -z "${hist[$p]}" ]] && continue
      candidates+=("$p"$'\t'"$size"); (( total_bytes += size ))
    done <<< "$(jget "$reply" list)"
    touch "$LOCK" 2>/dev/null
  done
  (( ${#candidates} == 0 )) && return
  if [[ ! -f "$first_marker" ]]; then
    print -rl -- "${(o)candidates[@]}" > "$TIDY_REPORT"
    log "Leftover check: found ${#candidates} old cop$( (( ${#candidates} == 1 )) && print -n y || print -n ies) ($(human $total_bytes)) in Storage — listed in $TIDY_REPORT. Nothing changed yet."
    notify "Found ${#candidates} old copies ($(human $total_bytes)) left in Storage by renames. Nothing has been changed yet."
    return
  fi
  for (( i = 1; i <= ${#candidates}; i += 50 )); do
    body=""; sep=""
    for line in "${(@)candidates[i,i+49]}"; do body+="$sep{\"path\":\"$(json_escape "${line%%$'\t'*}")\"}"; sep=","; done
    reply=$(api "{\"action\":\"trash\",\"files\":[$body]}")
    [[ "$(jget "$reply" ok)" == "true" ]] || { log "Leftover tidy stopped (will try again): $(jget "$reply" message)"; break; }
    (( trashed += $(jget "$reply" trashed) ))
    touch "$LOCK" 2>/dev/null
  done
  if (( trashed > 0 )); then
    log "Leftover check: moved $trashed old cop$( (( trashed == 1 )) && print -n y || print -n ies) to Storage's Deleted files (restorable for 30 days)."
    notify "Tidied $trashed old cop$( (( trashed == 1 )) && print -n y || print -n ies) left in Storage by renames (in Deleted files for 30 days)."
  fi
}
leftovers

for rel in ${(k)S_SIZE}; do
  [[ -f "$ROOT/$rel" ]] || continue
  (( ${S_AT[$rel]} > cutoff )) && continue
  clear_one "$rel"
  touch "$LOCK" 2>/dev/null
  write_status
done
save_state

# Requests made while this run was busy.
while [[ -s "$REQ" ]]; do process_requests; done

# Folders are never removed from the Mac when their files are cleared: the
# whole folder layout stays, like Dropbox, so edited files can be dropped
# straight back into the right place.

# ---- Notifications ------------------------------------------------------

if (( uploaded > 0 )); then
  notify "Uploaded $uploaded file$( (( uploaded == 1 )) || print -n s) ($(human $uploaded_bytes)) to Storage."
fi
if (( freed > 0 )); then
  notify "Freed $(human $freed_bytes) on this Mac — $freed file$( (( freed == 1 )) || print -n s) now only in Storage."
fi
if (( ${#too_big} > 0 )); then
  marker="$SUPPORT/notified-too-big"
  if [[ ! -f "$marker" ]] || [[ -n $(find "$marker" -mtime +1 2>/dev/null) ]]; then
    notify "${#too_big} file(s) are over 5 GB and can't be uploaded yet, e.g. ${too_big[1]:t}"
    touch "$marker"
  fi
fi
if (( failed > 0 )); then
  log "$failed file(s) will be retried next time."
fi

onmac_stats
STATUS_STATE="idle"
write_status now

# Built last, so a first (slow, low-priority) build never holds up uploads.
[[ -z "$SGS_NO_MENUBAR" ]] && install_menubar
exit 0
