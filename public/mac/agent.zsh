#!/bin/zsh
# Steve Gregson Storage — Mac uploader.
#
# Runs in the background (launchd) every few minutes and whenever the
# Storage folder changes:
#   1. uploads new or changed files from ~/Steve Gregson Storage, several at
#      once (UPLOAD_JOBS, default 8) so big batches use the full connection
#   2. after OFFLOAD_DAYS, asks Storage to confirm it holds an exact copy
#      (same size and MD5 fingerprint) and only then removes the Mac copy.
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
NOW=${SGS_NOW:-$(date +%s)}

SERVER=""
OFFLOAD_DAYS=7
UPLOAD_JOBS=8          # files uploaded at the same time
[[ -f "$CONFIG" ]] && source "$CONFIG"
[[ -n "$SGS_UPLOAD_JOBS" ]] && UPLOAD_JOBS=$SGS_UPLOAD_JOBS
[[ "$UPLOAD_JOBS" == <-> ]] && (( UPLOAD_JOBS >= 1 && UPLOAD_JOBS <= 32 )) || UPLOAD_JOBS=8

mkdir -p "$SUPPORT" "${LOG:h}"
touch "$STATE"

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG"; }

notify() {
  [[ -n "$SGS_NO_NOTIFY" ]] && return
  local text="${1//\"/\\\"}"
  osascript -e "display notification \"$text\" with title \"$APP_NAME\"" >/dev/null 2>&1
}

token() {
  if [[ -n "$SGS_TOKEN" ]]; then print -r -- "$SGS_TOKEN"; return; fi
  security find-generic-password -a "$USER" -s "$APP_NAME" -w 2>/dev/null
}

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
failed=0
typeset -a too_big emptied

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

# ---- 2. Free up space for files uploaded over OFFLOAD_DAYS ago ---------
cutoff=$(( NOW - OFFLOAD_DAYS * 86400 ))
for rel in ${(k)S_SIZE}; do
  file="$ROOT/$rel"
  if [[ ! -f "$file" ]]; then
    forget "$rel"          # removed from the Mac by hand; Storage keeps its copy
    continue
  fi
  (( ${S_AT[$rel]} > cutoff )) && continue

  info=($(file_info "$file")) || continue
  # Changed since it was uploaded: the upload step will send the new version.
  [[ "${info[1]}" == "${S_SIZE[$rel]}" && "${info[2]}" == "${S_MTIME[$rel]}" ]] || continue

  # Re-check the file on the Mac really is what was uploaded…
  [[ "$(md5_of "$file")" == "${S_MD5[$rel]}" ]] || { log "Kept $rel: it no longer matches what was uploaded."; continue; }

  # …and that Storage holds an exact copy right now.
  reply=$(api "{\"action\":\"verify\",\"remotePath\":\"$(json_escape "${S_REMOTE[$rel]}")\",\"size\":${S_SIZE[$rel]},\"md5Hex\":\"${S_MD5[$rel]}\"}")
  if [[ "$(jget "$reply" ok)" != "true" || "$(jget "$reply" safe)" != "true" ]]; then
    reason=$(jget "$reply" reason)
    case "$reason" in
      deleted_in_storage) log "Kept $rel on the Mac: it was deleted in Storage." ;;
      not_recorded|missing) log "Kept $rel on the Mac: Storage no longer has it; it will be uploaded again."; forget "$rel" ;;
      *) log "Kept $rel on the Mac for now (couldn't confirm the copy in Storage)." ;;
    esac
    continue
  fi

  size=${S_SIZE[$rel]}
  if rm -f -- "$file"; then
    emptied+=("${file:h}")
    forget "$rel"
    (( freed++ ))
    (( freed_bytes += size ))
    log "Freed space: $rel is now only in Storage ($(jget "$reply" remotePath))."
  fi
done
save_state

# Tidy folders that this run emptied (never the Storage folder itself, never
# the top-level client folders like MOUNTVIEW, and never folders that were
# already empty).
for dir in ${(Ou)emptied}; do
  while [[ "$dir" == "$ROOT"/*/* && -d "$dir" ]]; do
    rm -f -- "$dir/.DS_Store" 2>/dev/null
    rmdir -- "$dir" 2>/dev/null || break
    dir="${dir:h}"
  done
done

# ---- Notifications ------------------------------------------------------
human() {
  local b=$1
  if (( b >= 1073741824 )); then printf "%.1f GB" $(( b / 1073741824.0 ))
  elif (( b >= 1048576 )); then printf "%.0f MB" $(( b / 1048576.0 ))
  else printf "%d KB" $(( (b + 1023) / 1024 )); fi
}

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
