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
# Nothing in Storage is ever deleted from here.

emulate -L zsh
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
  [[ "$kind" == bring-back || "$kind" == clear-now ]] || exit 0
  n=0
  for f in "$@"; do
    f="${f%/}"
    [[ "$f" == "$ROOT"/* ]] || continue
    print -r -- "$kind"$'\t'"${f#$ROOT/}" >> "$REQ"
    (( n++ ))
  done
  if (( n == 0 )); then
    notify "Choose a folder or file inside the $APP_NAME folder."
    exit 0
  fi
  if [[ "$kind" == bring-back ]]; then
    notify "Bringing back from Storage… you'll get a message when it's done."
  else
    notify "Clearing from this Mac (each file is checked in Storage first)…"
  fi
  launchctl kickstart "gui/$(id -u)/com.stevegregson.storage" >/dev/null 2>&1
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

# ---- State: one line per uploaded file --------------------------------
# relative path <TAB> size <TAB> modified <TAB> md5 <TAB> uploaded (epoch) <TAB> storage path
typeset -A S_SIZE S_MTIME S_MD5 S_AT S_REMOTE
while IFS=$'\t' read -r rel size mtime md5 at remote; do
  [[ -z "$rel" ]] && continue
  S_SIZE[$rel]=$size; S_MTIME[$rel]=$mtime; S_MD5[$rel]=$md5; S_AT[$rel]=$at; S_REMOTE[$rel]=$remote
done < "$STATE"

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
  else
    log "Couldn't reach $SERVER (offline?). Will try again later."
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

uploaded=0
uploaded_bytes=0
freed=0
freed_bytes=0
fetched=0
fetched_bytes=0
failed=0
typeset -a too_big

# ---- 1. Upload new or changed files ------------------------------------
# Each file is uploaded by its own background job (UPLOAD_JOBS at a time).
# A job writes its outcome to a small file; this run reads it back and
# records the upload, so the record of what's uploaded is kept in one place.
RESULTS="$SUPPORT/uploading"
rm -rf "$RESULTS"; mkdir -p "$RESULTS"
typeset -A RUNNING      # process id -> job number
typeset -A JOB_REL      # job number -> relative path
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

  # If the file changed while uploading, leave it for the next run.
  after=($(file_info "$file"))
  if [[ "${after[1]}" != "$size" || "${after[2]}" != "$mtime" ]]; then
    finish skip; return
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
  case "${f[1]}" in
    ok)
      S_SIZE[$rel]=${f[2]}; S_MTIME[$rel]=${f[3]}; S_MD5[$rel]=${f[4]}; S_AT[$rel]=$NOW; S_REMOTE[$rel]=${f[5]}
      (( uploaded++ ))
      (( uploaded_bytes += f[2] ))
      (( unsaved++ ))
      ;;
    got)
      # Brought back from Storage: it's already there, so no upload needed,
      # and it stays on the Mac for OFFLOAD_DAYS from now.
      S_SIZE[$rel]=${f[2]}; S_MTIME[$rel]=${f[3]}; S_MD5[$rel]=${f[4]}; S_AT[$rel]=$(date +%s); S_REMOTE[$rel]=${f[5]}
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
}

upload_pass() {
  pending=0
  while IFS= read -r -d '' file; do
    rel="${file#$ROOT/}"
    [[ "$rel" == *$'\t'* || "$rel" == *$'\n'* ]] && { log "Skipped (tab or line break in name): $rel"; continue; }

    info=($(file_info "$file")) || continue
    size=${info[1]}; mtime=${info[2]}; ctime=${info[3]}

    # Already uploaded and unchanged?
    if [[ -n "${S_SIZE[$rel]}" && "${S_SIZE[$rel]}" == "$size" && "${S_MTIME[$rel]}" == "$mtime" ]]; then
      continue
    fi

    # Wait until a file has finished copying in.
    newest=$(( mtime > ctime ? mtime : ctime ))
    (( NOW - newest < SETTLE_SECONDS )) && { (( pending++ )); continue; }

    if (( size > MAX_BYTES )); then
      too_big+=("$rel")
      continue
    fi

    # Wait for a free slot, then start this file's upload.
    while (( ${#RUNNING} >= UPLOAD_JOBS )); do
      sleep 0.2
      reap
    done
    (( job_no++ ))
    JOB_REL[$job_no]=$rel
    upload_one "$file" "$rel" "$RESULTS/$job_no" "$size" "$mtime" &
    RUNNING[$!]=$job_no
  done < <(find "$ROOT" -type f ! -name '.*' ! -path '*/.*' ! -name 'Icon?' -print0 2>/dev/null)

  # Let the last uploads finish.
  while (( ${#RUNNING} > 0 )); do
    sleep 0.2
    reap
  done
  save_state; unsaved=0
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
  local got=$(( fetched - f0 )) bad=$(( failed - x0 ))
  failed=$x0
  if (( bad > 0 )); then
    notify "Brought back $got file(s) to ${rel:t}; $bad couldn't be fetched — try Bring back again."
  else
    notify "Brought back $got file(s) ($(human $(( fetched_bytes - b0 )))) to ${rel:t}. They'll stay on this Mac for $OFFLOAD_DAYS days."
  fi
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
    esac
  done < "$work"
  rm -f -- "$work"
  save_state
}

process_requests

# ---- 2. Free up space for files uploaded over OFFLOAD_DAYS ago ---------
[[ "$OFFLOAD_SET" != "$OFFLOAD_DAYS" ]] && log "Days-to-keep setting was '$OFFLOAD_SET'; using $OFFLOAD_DAYS days instead (minimum is 1)."
cutoff=$(( NOW - OFFLOAD_DAYS * 86400 ))
for rel in ${(k)S_SIZE}; do
  if [[ ! -f "$ROOT/$rel" ]]; then
    forget "$rel"          # removed from the Mac by hand; Storage keeps its copy
    continue
  fi
  (( ${S_AT[$rel]} > cutoff )) && continue
  clear_one "$rel"
  touch "$LOCK" 2>/dev/null
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
exit 0
