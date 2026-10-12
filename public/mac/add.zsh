#!/bin/zsh
# Used by the Dock icon: puts dropped files and folders into the
# Steve Gregson Storage folder and starts uploading straight away.
# Items on this Mac's own disk are moved (like dragging into Dropbox);
# items on a card or external drive are copied, so the original stays put.

emulate -L zsh
APP_NAME="Steve Gregson Storage"
ROOT="${SGS_ROOT:-$HOME/$APP_NAME}"
mkdir -p "$ROOT"

# "Hamlet.jpg" → "Hamlet 2.jpg" if the name is already taken.
free_name() {
  local target="$1" base ext n=2
  [[ ! -e "$target" ]] && { print -r -- "$target"; return; }
  if [[ -d "$target" || "${target:t}" != *.* ]]; then base="$target"; ext=""
  else base="${target%.*}"; ext=".${target##*.}"; fi
  while [[ -e "$base $n$ext" ]]; do (( n++ )); done
  print -r -- "$base $n$ext"
}

moved=0 copied=0
for item in "$@"; do
  item="${item%/}"
  [[ -e "$item" ]] || continue
  # Already inside the Storage folder: nothing to do.
  [[ "$item" == "$ROOT" || "$item" == "$ROOT"/* ]] && continue
  target=$(free_name "$ROOT/${item:t}")
  if [[ "$item" == /Volumes/* ]]; then
    cp -R -p -- "$item" "$target" && (( copied++ ))
  else
    mv -- "$item" "$target" && (( moved++ ))
  fi
done

launchctl kickstart "gui/$(id -u)/com.stevegregson.storage" >/dev/null 2>&1

total=$(( moved + copied ))
if (( total == 0 )); then
  print "Nothing new to add."
elif (( total == 1 )); then
  print "Added 1 item — uploading to Storage now."
else
  print "Added $total items — uploading to Storage now."
fi
